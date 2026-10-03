const KEYS = [
  import.meta.env.VITE_GEMINI_KEY_1 || '',
  import.meta.env.VITE_GEMINI_KEY_2 || '',
  import.meta.env.VITE_GEMINI_KEY_3 || '',
].filter(k => k.length > 0);

let currentKeyIndex = 0;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Hard-timeout fetch – prevents 504 gateway hangs */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Groq fallback ----------
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const GROQ_MODEL   = 'openai/gpt-oss-120b'; // model set by user

async function askGroq(prompt: string): Promise<string> {
  const res = await fetchWithTimeout(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
      }),
    },
    20000
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`Groq failed (${res.status}):`, err);
    throw new Error(`Groq ${res.status}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

// ---------- Gemini fallback chain ----------
// If one model name returns 404 we immediately move to the next one.
// Order: newest → most stable, so we always get the best available.
const GEMINI_MODELS = [
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-1.5-flash',
  'gemini-1.5-flash-001',
  'gemini-1.5-pro',
];

let workingModelIndex = 0; // remember which model works, skip re-probing

async function callGemini(key: string, model: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    },
    15000
  );

  if (!response.ok) {
    const status = response.status;
    if (status === 404) throw new Error('404_MODEL_NOT_FOUND');
    if (status === 429) throw new Error('429_RATE_LIMITED');
    if (status === 503 || status === 504) throw new Error(`${status}_GATEWAY`);
    throw new Error(`GEMINI_${status}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

export async function askGemini(prompt: string, context?: string): Promise<string> {
  const fullPrompt = context ? `Context:\n${context}\n\n${prompt}` : prompt;

  // Try each model. On 404, move to the next model immediately (no backoff wasted).
  // On 429/503/504/timeout, rotate key and retry same model.
  for (let mi = workingModelIndex; mi < GEMINI_MODELS.length; mi++) {
    const model = GEMINI_MODELS[mi];

    for (let attempt = 0; attempt < KEYS.length + 1; attempt++) {
      const key = KEYS[currentKeyIndex % KEYS.length];

      try {
        const result = await callGemini(key, model, fullPrompt);
        // Success — remember this model so future calls skip dead ones
        workingModelIndex = mi;
        console.info(`✅ Gemini OK — model: ${model}, key: ${currentKeyIndex % KEYS.length + 1}`);
        return result;
      } catch (err: any) {
        const msg: string = err.message || '';

        if (msg === '404_MODEL_NOT_FOUND') {
          // This model doesn't exist — no point retrying with different keys
          console.warn(`⚠️ Gemini model "${model}" not found (404). Trying next model...`);
          break; // break inner loop → advance mi
        }

        if (msg === '429_RATE_LIMITED') {
          console.warn(`⚠️ Key ${currentKeyIndex % KEYS.length + 1} rate-limited on ${model}. Rotating...`);
          currentKeyIndex++;
          await sleep(500);
          continue;
        }

        if (msg.includes('_GATEWAY') || err.name === 'AbortError') {
          console.warn(`⚠️ ${model} gateway/timeout. Rotating key and backing off...`);
          currentKeyIndex++;
          await sleep(1000 * (attempt + 1));
          continue;
        }

        // Unknown error – rotate key
        console.warn(`⚠️ ${model} error (${msg}). Rotating key...`);
        currentKeyIndex++;
        await sleep(500);
      }
    }
  }

  // All Gemini models exhausted → Groq
  try {
    console.warn('🔄 All Gemini models failed. Falling back to Groq...');
    return await askGroq(fullPrompt);
  } catch (groqErr: any) {
    console.error('❌ Groq fallback also failed:', groqErr.message);
    return 'Sorry, all AI services are currently unavailable. Please try again in a moment.';
  }
}

export async function translateWithGemini(text: string, targetLanguage: string): Promise<string> {
  const prompt = `Translate the following text to ${targetLanguage}. Return ONLY the translation, no extra text:\n\n${text}`;
  return askGemini(prompt);
}

export async function factCheckWithGemini(claim: string): Promise<string> {
  const prompt = `You are an elite independent fact-checker. Analyze this claim or news snippet and determine if it is True, False, Misleading, or Unverified. Provide a short 3-sentence explanation formatted entirely in clean HTML tags (like <p>, <b>). Do not use markdown blocks:\n\nCLAIM: "${claim}"`;
  const result = await askGemini(prompt);
  return result.replace(/```html/gi, '').replace(/```/g, '').trim();
}
