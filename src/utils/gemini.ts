const GEMINI_KEYS = [
  import.meta.env.VITE_GEMINI_KEY_1 || '',
  import.meta.env.VITE_GEMINI_KEY_2 || '',
  import.meta.env.VITE_GEMINI_KEY_3 || '',
  import.meta.env.VITE_GEMINI_KEY_4 || '',
  import.meta.env.VITE_GEMINI_KEY_5 || '',
  import.meta.env.VITE_GEMINI_KEY_6 || ''
];

const GEMINI_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.5-flash-lite'
];

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
      model: "openai/gpt-oss-120b",
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

  // Retry up to 6 times across 6 keys with dual model rotation
  for (let attempt = 0; attempt < 6; attempt++) {
    const key = GEMINI_KEYS[currentKeyIndex];
    const model = GEMINI_MODELS[currentKeyIndex];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    
    try {
      console.log(`Attempt ${attempt + 1}: Using ${model} with Key ${currentKeyIndex + 1}`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      console.log(`Success with ${model} (Key ${currentKeyIndex + 1})`);
      return data.candidates[0].content.parts[0].text;
    } catch (error: any) {
      console.warn(`Attempt ${attempt + 1}: ${GEMINI_MODELS[currentKeyIndex]} with Key ${currentKeyIndex + 1} failed (${error.message}). Rotating and backing off...`);
      currentKeyIndex = (currentKeyIndex + 1) % GEMINI_KEYS.length;
      await sleep(1000 * (attempt + 1)); // exponential backoff
      
      if (attempt === 5) {
        try {
          console.warn("All Gemini attempts exhausted, attempting Groq fallback...");
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
  const prompt = `You are an elite independent fact-checker. Analyze this claim or news snippet and determine if it is True, False, Misleading, or Unverified. Provide a short 3-sentence explanation with sources if possible. Format as HTML with <strong> tags for key terms.`;
  let result = await askGemini(prompt);
  return result.replace(/```html/gi, '').replace(/```/g, '').trim();
}
