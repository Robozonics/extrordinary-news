const KEYS = [
  import.meta.env.VITE_GEMINI_KEY_1 || '',
  import.meta.env.VITE_GEMINI_KEY_2 || '',
  import.meta.env.VITE_GEMINI_KEY_3 || ''
].filter(k => k.length > 0);

let currentKeyIndex = 0;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Fetch with a hard timeout – kills requests that stall (prevents 504 gateway errors) */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";
// Model updated to openai/gpt-oss-120b as requested
const GROQ_MODEL = "openai/gpt-oss-120b";

async function askGroq(prompt: string): Promise<string> {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  // 20s timeout to avoid 504 gateway errors on Groq's side
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024
    })
  }, 20000);

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Groq API failed (${res.status}):`, errText);
    throw new Error(`Groq API failed: ${res.status}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

export async function askGemini(prompt: string, context?: string): Promise<string> {
  const systemContext = context ? `Context:\n${context}\n\n` : '';
  const fullPrompt = `${systemContext}${prompt}`;

  // Retry up to 4 times across keys with 15s timeout per request
  for (let attempt = 0; attempt < 4; attempt++) {
    const key = KEYS[currentKeyIndex % KEYS.length];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;

    try {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }]
        })
      }, 15000);

      if (!response.ok) {
        // 503 = overloaded, 504 = gateway timeout – both warrant a retry with key rotation
        if (response.status === 503 || response.status === 504) {
          throw new Error(`${response.status} Gateway/Service Unavailable`);
        }
        // 429 = rate limit on this key – rotate
        if (response.status === 429) {
          throw new Error('429 Rate Limited');
        }
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
    } catch (error: any) {
      const reason = error.name === 'AbortError' ? 'Request timed out (15s)' : error.message;
      console.warn(`Attempt ${attempt + 1}: Key ${(currentKeyIndex % KEYS.length) + 1} failed (${reason}). Rotating key and backing off...`);
      currentKeyIndex = (currentKeyIndex + 1) % KEYS.length;
      // Exponential backoff: 1s, 2s, 3s
      await sleep(1000 * (attempt + 1));

      if (attempt === 3) {
        // All Gemini keys/attempts exhausted – fall back to Groq
        try {
          console.warn("Gemini exhausted, attempting Groq fallback...");
          return await askGroq(fullPrompt);
        } catch (groqErr: any) {
          console.error("Groq fallback also failed:", groqErr.message);
          return "Sorry, the AI is currently overloaded or timed out. Please try again in a few moments.";
        }
      }
    }
  }
  return "Error.";
}

export async function translateWithGemini(text: string, targetLanguage: string): Promise<string> {
  const prompt = `Translate the following text to ${targetLanguage}. Return ONLY the translation, no extra text:\n\n${text}`;
  return askGemini(prompt);
}

export async function factCheckWithGemini(claim: string): Promise<string> {
  const prompt = `You are an elite independent fact-checker. Analyze this claim or news snippet and determine if it is True, False, Misleading, or Unverified. Provide a short 3-sentence explanation formatted entirely in clean HTML tags (like <p>, <b>). Do not use markdown blocks:\n\nCLAIM: "${claim}"`;
  let result = await askGemini(prompt);
  return result.replace(/```html/gi, '').replace(/```/g, '').trim();
}
