import { askGemini } from './gemini';

const MULTI_RSS_FEEDS: Record<string, string[]> = {
  'World': [
    'http://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/World.xml'
  ],
  'America': [
    'https://rss.nytimes.com/services/xml/rss/nyt/US.xml'
  ],
  'Europe': [
    'https://www.france24.com/en/europe/rss'
  ],
  'India': [
    'https://timesofindia.indiatimes.com/rssfeedstopstories.cms'
  ],
  'Sports': [
    'http://feeds.bbci.co.uk/sport/rss.xml'
  ],
  'Tech': [
    'https://techcrunch.com/feed/'
  ],
};

export interface LiveArticle {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  source: string;
  image: string;
  summary: string;
  content?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

function shuffleArray(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export async function fetchLiveNews(category: string, query?: string): Promise<LiveArticle[]> {
  try {
    if (query || category === 'Local' || category === 'Leaders' || category === 'Blind Spot') {
      // Include today's date so the AI stays anchored to the current week
      const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      let searchPrompt = '';
      if (category === 'Leaders') {
        searchPrompt = `Today is ${todayStr}. You are a real-time news synthesizer. Provide 5 breaking news headlines and summaries strictly about quotes, statements, actions, or meetings of global World Leaders (e.g., Presidents, Prime Ministers) that happened within the LAST 7 DAYS (no older). Return ONLY a valid JSON array of objects with keys: "title", "summary", "source", "imageKeyword" (a single word for unsplash). No markdown, just JSON.`;
      } else if (category === 'Blind Spot') {
        searchPrompt = `Today is ${todayStr}. You are a real-time news synthesizer. Provide 5 highly important global news stories happening RIGHT NOW (within the last 7 days, no older) that are NOT being covered heavily by mainstream media (under-reported, hidden gems, or crucial blind spots). Return ONLY a valid JSON array of objects with keys: "title", "summary", "source", "imageKeyword". No markdown, just JSON.`;
      } else {
        searchPrompt = `Today is ${todayStr}. You are a real-time news synthesizer. Provide 5 breaking news headlines and summaries for the topic/location: "${query || category}" strictly from within the LAST 7 DAYS only (nothing older). Return ONLY a valid JSON array of objects with keys: "title", "summary", "source" (invent a realistic one if needed), "imageKeyword" (a single word for unsplash). No markdown, just JSON.`;
      }
      
      const aiResponse = await askGemini(searchPrompt);
      try {
        const jsonStr = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const items = JSON.parse(jsonStr);
        return items.map((item: any, i: number) => ({
          id: `ai-${Date.now()}-${i}`,
          title: item.title,
          link: '#',
          pubDate: new Date().toISOString(),
          source: item.source || 'AI Live Reporter',
          image: `https://picsum.photos/seed/${encodeURIComponent(item.title)}/600/400.webp`,
          summary: item.summary,
          content: item.summary,
          sentiment: 'neutral'
        }));
      } catch (e) {
        console.error("Gemini JSON parse failed", e);
      }
    }

    // 2. Normal RSS Fetching
    const urls = MULTI_RSS_FEEDS[category] || MULTI_RSS_FEEDS['World'];
    const fetchPromises = urls.map(async (rssUrl) => {
      const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000); // 10s timeout per RSS feed
        const res = await fetch(apiUrl, { signal: controller.signal });
        clearTimeout(timer);
        const data = await res.json();
        if (data.status === 'ok') {
          return data.items.map((item: any, index: number) => ({
            id: `${Math.random().toString(36).substr(2, 9)}-${index}`,
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
            source: data.feed.title || category,
            image: item.enclosure?.link || item.thumbnail || `https://picsum.photos/seed/${encodeURIComponent(category + index)}/600/400.webp`,
            summary: item.description.replace(/<[^>]*>?/gm, '').substring(0, 180) + '...',
            content: item.content || item.description
          }));
        }
        return [];
      } catch (e) {
        console.warn(`RSS feed timed out or failed: ${rssUrl}`);
        return [];
      }
    });

    const resultsArray = await Promise.all(fetchPromises);
    
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    let allArticles = resultsArray.flat().filter(a => {
      if (!a.title) return false;
      const pubTime = new Date(a.pubDate).getTime();
      if (isNaN(pubTime)) return true; // If date parsing fails, keep it to be safe
      return (now - pubTime) <= ONE_WEEK_MS; // Must be 7 days old max
    });
    
    return shuffleArray(allArticles);
  } catch (e) {
    console.error("Failed to fetch RSS", e);
    return [];
  }
}

export async function scrapeFullArticle(url: string): Promise<string> {
  if (url === '#') return "";
  try {
    let html = '';
    
    // Proxy 1: CodeTabs
    try {
      const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`);
      if (res.ok) html = await res.text();
    } catch (e) {}

    // Proxy 2: AllOrigins (Fallback)
    if (!html || html.includes('Cloudflare') || html.includes('captcha')) {
      try {
        const res2 = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
        const data = await res2.json();
        html = data.contents;
      } catch (e) {}
    }

    if (!html || html.includes('Cloudflare') || html.includes('captcha')) {
      return "The news source is heavily protected by anti-bot measures (Cloudflare/Paywall). We cannot extract the full article.";
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Aggressively remove junk
    const junk = doc.querySelectorAll('script, style, nav, header, footer, iframe, form, button, aside, .ad, .advertisement');
    junk.forEach(el => el.remove());

    // Find main container
    let container = doc.querySelector('article') || 
                    doc.querySelector('main') || 
                    doc.querySelector('.story-body') || 
                    doc.querySelector('.article-body') || 
                    doc.querySelector('#main-content') ||
                    doc.body;

    const paragraphs = Array.from(container.querySelectorAll('p'))
      .map(p => p.textContent?.trim() || "")
      .filter(text => text.length > 50); // Filter out short UI text like "Click here"
      
    if (paragraphs.length === 0) {
      // Fallback: just get all text nodes if <p> tags aren't used
      return container.textContent?.replace(/\s+/g, ' ').trim() || "Failed to extract article content. Source might be heavily protected.";
    }
    
    return paragraphs.join('\n\n');
  } catch (e) {
    console.error(e);
    return "Error fetching the full story from the original source.";
  }
}
