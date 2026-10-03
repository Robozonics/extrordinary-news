// ---------------------------------------------------------------------------
// Groq is PRIMARY. Gemini is fallback (requires valid AIza... API keys).
// ---------------------------------------------------------------------------

const GEMINI_KEYS = [
  import.meta.env.VITE_GEMINI_KEY_1 || '',
  import.meta.env.VITE_GEMINI_KEY_2 || '',
  import.meta.env.VITE_GEMINI_KEY_3 || '',
].filter(k => k.startsWith('AIza')); // only accept real Gemini keys (AIza...)

let geminiKeyIndex = 0;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Hard-timeout fetch – prevents 504/hanging requests */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// GROQ — Primary AI
// Tries multiple models in order in case one isn't available on the account.
// ---------------------------------------------------------------------------
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';

const GROQ_MODELS = [
  'openai/gpt-oss-120b',      // user-specified preferred model
  'llama-3.3-70b-versatile',  // reliable large Llama on Groq
  'llama-3.1-70b-versatile',
  'llama-3.1-8b-instant',     // last-resort fast model
];

let groqModelIndex = 0; // remember last working model

async function askGroq(prompt: string): Promise<string> {
  for (let mi = groqModelIndex; mi < GROQ_MODELS.length; mi++) {
    const model = GROQ_MODELS[mi];
    try {
      const res = await fetchWithTimeout(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1500,
            temperature: 0.7,
          }),
        },
        20000
      );

      if (!res.ok) {
        const err = await res.text();
        if (res.status === 404) {
          console.warn(`⚠️ Groq model "${model}" not found. Trying next...`);
          continue; // try next model
        }
        if (res.status === 429) {
          console.warn(`⚠️ Groq rate-limited on "${model}". Backing off...`);
          await sleep(1500);
          continue;
        }
        console.error(`Groq error (${res.status}):`, err);
        throw new Error(`Groq ${res.status}`);
      }

      const data = await res.json();
      groqModelIndex = mi; // remember working model
      console.info(`✅ Groq OK — model: ${model}`);
      return data.choices[0].message.content;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn(`⚠️ Groq model "${model}" timed out. Trying next...`);
        continue;
      }
      if (err.message?.includes('404')) continue;
      throw err;
    }
  }
  throw new Error('All Groq models exhausted');
}

// ---------------------------------------------------------------------------
// GEMINI — Fallback AI (only used if valid AIza... keys are present)
// ---------------------------------------------------------------------------
const GEMINI_MODELS = [
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];
let geminiModelIndex = 0;

async function askGeminiDirect(prompt: string): Promise<string> {
  if (GEMINI_KEYS.length === 0) throw new Error('No valid Gemini keys');

  for (let mi = geminiModelIndex; mi < GEMINI_MODELS.length; mi++) {
    const model = GEMINI_MODELS[mi];
    const key = GEMINI_KEYS[geminiKeyIndex % GEMINI_KEYS.length];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        },
        15000
      );

      if (!res.ok) {
        if (res.status === 404) { console.warn(`Gemini model "${model}" 404`); continue; }
        if (res.status === 429) { geminiKeyIndex++; await sleep(1000); continue; }
        if (res.status === 503 || res.status === 504) { await sleep(1000); continue; }
        throw new Error(`Gemini ${res.status}`);
      }

      const data = await res.json();
      geminiModelIndex = mi;
      return data.candidates[0].content.parts[0].text;
    } catch (err: any) {
      if (err.name === 'AbortError') continue;
      if (err.message?.includes('404')) continue;
      throw err;
    }
  }
  throw new Error('All Gemini models exhausted');
}

// ---------------------------------------------------------------------------
// PUBLIC API — Groq first, Gemini fallback, then friendly error message
// ---------------------------------------------------------------------------
export async function askGemini(prompt: string, context?: string): Promise<string> {
  const fullPrompt = context ? `Context:\n${context}\n\n${prompt}` : prompt;

  // 1. Try Groq (primary)
  try {
    return await askGroq(fullPrompt);
  } catch (groqErr: any) {
    console.warn('Groq failed, trying Gemini fallback...', groqErr.message);
  }

  // 2. Try Gemini (fallback)
  try {
    return await askGeminiDirect(fullPrompt);
  } catch (gemErr: any) {
    console.error('Both Groq and Gemini failed:', gemErr.message);
  }

  return 'Sorry, all AI services are currently unavailable. Please try again in a moment.';
}

export async function translateWithGemini(text: string, targetLanguage: string): Promise<string> {
  return askGemini(
    `Translate the following text to ${targetLanguage}. Return ONLY the translation, no extra text:\n\n${text}`
  );
}

export async function factCheckWithGemini(claim: string, context?: string): Promise<string> {
  const result = await askGemini(
    `You are an elite independent fact-checker. Analyze this claim or news snippet and determine if it is True, False, Misleading, or Unverified. Provide a short 3-sentence explanation formatted entirely in clean HTML tags (like <p>, <b>). Do not use markdown blocks:\n\nCLAIM: "${claim}"`,
    context
  );
  return result.replace(/```html/gi, '').replace(/```/g, '').trim();
}
