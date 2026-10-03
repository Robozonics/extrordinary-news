import { askGemini } from './gemini';

// ---------------------------------------------------------------------------
// RSS feed sources — broad coverage across categories
// ---------------------------------------------------------------------------
const MULTI_RSS_FEEDS: Record<string, string[]> = {
  World: [
    'http://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
  ],
  America: [
    'https://rss.nytimes.com/services/xml/rss/nyt/US.xml',
    'https://feeds.npr.org/1001/rss.xml',
  ],
  Europe: [
    'https://www.france24.com/en/europe/rss',
    'https://feeds.bbci.co.uk/news/world/europe/rss.xml',
  ],
  India: [
    'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
    'https://www.thehindu.com/news/national/feeder/default.rss',
  ],
  Sports: [
    'http://feeds.bbci.co.uk/sport/rss.xml',
    'https://www.espn.com/espn/rss/news',
  ],
  Tech: [
    'https://techcrunch.com/feed/',
    'https://www.theverge.com/rss/index.xml',
  ],
};

// Extra feeds used purely to build a grounding context for AI categories
const AI_CONTEXT_FEEDS = [
  'http://feeds.bbci.co.uk/news/world/rss.xml',
  'https://www.aljazeera.com/xml/rss/all.xml',
  'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
  'https://rss.nytimes.com/services/xml/rss/nyt/US.xml',
  'https://www.france24.com/en/rss',
  'https://feeds.npr.org/1001/rss.xml',
  'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
  'https://techcrunch.com/feed/',
  'http://feeds.bbci.co.uk/sport/rss.xml',
];

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Fetch a single RSS feed via rss2json with a 10s hard timeout */
async function fetchRSSFeed(rssUrl: string, category: string): Promise<LiveArticle[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(
      `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    const data = await res.json();
    if (data.status !== 'ok') return [];

    const now = Date.now();
    return data.items
      .filter((item: any) => {
        if (!item.title) return false;
        const pub = new Date(item.pubDate).getTime();
        return isNaN(pub) || now - pub <= ONE_WEEK_MS;
      })
      .map((item: any, index: number) => ({
        id: `${Math.random().toString(36).substr(2, 9)}-${index}`,
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        source: data.feed.title || category,
        image:
          item.enclosure?.link ||
          item.thumbnail ||
          `https://picsum.photos/seed/${encodeURIComponent(category + index)}/600/400.webp`,
        summary: item.description.replace(/<[^>]*>?/gm, '').substring(0, 200) + '...',
        content: item.content || item.description,
      }));
  } catch {
    console.warn(`RSS timed out or failed: ${rssUrl}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Build a grounding context string from REAL fetched headlines.
// This is what gets passed to the AI so it answers based on actual news,
// not its training data.
// ---------------------------------------------------------------------------
async function buildNewsContext(extraFeeds?: string[]): Promise<string> {
  const feeds = extraFeeds ?? AI_CONTEXT_FEEDS;
  const results = await Promise.all(feeds.map(url => fetchRSSFeed(url, 'World')));
  const now = Date.now();

  const articles = results
    .flat()
    .filter(a => {
      const pub = new Date(a.pubDate).getTime();
      return isNaN(pub) || now - pub <= ONE_WEEK_MS;
    })
    .slice(0, 40); // cap at 40 articles to keep prompt manageable

  if (articles.length === 0) return '';

  return articles
    .map(
      (a, i) =>
        `[${i + 1}] ${a.source}: "${a.title}"\n    Summary: ${a.summary}`
    )
    .join('\n\n');
}

// ---------------------------------------------------------------------------
// Main fetch function
// ---------------------------------------------------------------------------
export async function fetchLiveNews(category: string, query?: string): Promise<LiveArticle[]> {
  try {
    const todayStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // AI-driven categories: fetch REAL news context first, then ask AI to curate
    if (query || category === 'Local' || category === 'Leaders' || category === 'Blind Spot') {
      // 1. Fetch real headlines from news outlets (runs in parallel with building prompt)
      console.info('📡 Fetching real news context from RSS feeds...');
      const newsContext = await buildNewsContext();

      const contextBlock = newsContext
        ? `\n\nHere are REAL news articles fetched RIGHT NOW (${todayStr}) from major outlets (BBC, Al Jazeera, NYT, NPR, France24, etc.):\n\n${newsContext}\n\n`
        : '';

      const noContextNote = newsContext
        ? 'Base your answer EXCLUSIVELY on the real articles listed above. Do NOT use your training knowledge.'
        : `Today is ${todayStr}. Use your best knowledge of recent events from within the last 7 days only.`;

      let searchPrompt = '';

      if (category === 'Leaders') {
        searchPrompt = `${contextBlock}You are a news editor. From the real articles above, identify and return 5 stories specifically about global World Leaders (Presidents, Prime Ministers, heads of state) — their quotes, decisions, meetings, or actions within the last 7 days.${noContextNote}\n\nReturn ONLY a valid JSON array with keys: "title", "summary", "source", "imageKeyword" (one word). No markdown, just JSON.`;
      } else if (category === 'Blind Spot') {
        searchPrompt = `${contextBlock}You are an investigative editor. From the real articles above, pick 5 stories that are critically important but are being UNDERREPORTED or OVERLOOKED by mainstream coverage. These are the hidden gems or "blind spots" in the news cycle.${noContextNote}\n\nReturn ONLY a valid JSON array with keys: "title", "summary", "source", "imageKeyword" (one word). No markdown, just JSON.`;
      } else {
        const topic = query || category;
        searchPrompt = `${contextBlock}You are a news editor. From the real articles above, find and return 5 stories most relevant to: "${topic}". If fewer than 5 match, supplement with related stories.${noContextNote}\n\nReturn ONLY a valid JSON array with keys: "title", "summary", "source", "imageKeyword" (one word). No markdown, just JSON.`;
      }

      try {
        const aiResponse = await askGemini(searchPrompt);
        const jsonStr = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const items = JSON.parse(jsonStr);
        return items.map((item: any, i: number) => ({
          id: `ai-${Date.now()}-${i}`,
          title: item.title,
          link: '#',
          pubDate: new Date().toISOString(),
          source: item.source || 'Live News Desk',
          image: `https://picsum.photos/seed/${encodeURIComponent(item.title || i)}/600/400.webp`,
          summary: item.summary,
          content: item.summary,
          sentiment: 'neutral' as const,
        }));
      } catch (e) {
        console.error('AI news parse failed, falling back to RSS', e);
        // Fall through to normal RSS fetch
      }
    }

    // Standard RSS fetch for named categories
    const urls = MULTI_RSS_FEEDS[category] || MULTI_RSS_FEEDS['World'];
    const resultsArray = await Promise.all(urls.map(url => fetchRSSFeed(url, category)));
    return shuffleArray(resultsArray.flat().filter(a => a.title));
  } catch (e) {
    console.error('fetchLiveNews failed', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Full article scraper (proxy chain)
// ---------------------------------------------------------------------------
export async function scrapeFullArticle(url: string): Promise<string> {
  if (url === '#') return '';
  try {
    let html = '';

    // Proxy 1: CodeTabs
    try {
      const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`);
      if (res.ok) html = await res.text();
    } catch {}

    // Proxy 2: AllOrigins fallback
    if (!html || html.includes('Cloudflare') || html.includes('captcha')) {
      try {
        const res2 = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
        const data = await res2.json();
        html = data.contents;
      } catch {}
    }

    if (!html || html.includes('Cloudflare') || html.includes('captcha')) {
      return 'The news source is heavily protected by anti-bot measures (Cloudflare/Paywall). We cannot extract the full article.';
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    doc
      .querySelectorAll('script, style, nav, header, footer, iframe, form, button, aside, .ad, .advertisement')
      .forEach(el => el.remove());

    const container =
      doc.querySelector('article') ||
      doc.querySelector('main') ||
      doc.querySelector('.story-body') ||
      doc.querySelector('.article-body') ||
      doc.querySelector('#main-content') ||
      doc.body;

    const paragraphs = Array.from(container.querySelectorAll('p'))
      .map(p => p.textContent?.trim() || '')
      .filter(t => t.length > 50);

    if (paragraphs.length === 0) {
      return container.textContent?.replace(/\s+/g, ' ').trim() || 'Failed to extract article content.';
    }

    return paragraphs.join('\n\n');
  } catch (e) {
    console.error(e);
    return 'Error fetching the full story from the original source.';
  }
}
