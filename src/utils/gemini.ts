const KEYS = [
  import.meta.env.VITE_GEMINI_KEY_1 || '',
  import.meta.env.VITE_GEMINI_KEY_2 || '',
  import.meta.env.VITE_GEMINI_KEY_3 || ''
].filter(k => k.length > 0);

let currentKeyIndex = 0;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";

async function askGroq(prompt: string): Promise<string> {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("Groq API failed:", errText);
    throw new Error("Groq API failed");
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

export async function askGemini(prompt: string, context?: string): Promise<string> {
  const systemContext = context ? `Context:\n${context}\n\n` : '';
  const fullPrompt = `${systemContext}${prompt}`;

  // Retry up to 4 times across keys
  for (let attempt = 0; attempt < 4; attempt++) {
    const key = KEYS[currentKeyIndex];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }]
        })
      });

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error("503 Service Unavailable");
        }
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
    } catch (error: any) {
      console.warn(`Attempt ${attempt + 1}: Key ${currentKeyIndex + 1} failed (${error.message}). Rotating and backing off...`);
      currentKeyIndex = (currentKeyIndex + 1) % KEYS.length;
      await sleep(1000 * (attempt + 1)); // exponential backoff
      
      if (attempt === 3) {
        try {
          console.warn("Gemini exhausted, attempting Groq fallback...");
          return await askGroq(fullPrompt);
        } catch (groqErr) {
          return "Sorry, the AI is currently overloaded (503). We are experiencing high traffic. Please try again in a few moments.";
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
