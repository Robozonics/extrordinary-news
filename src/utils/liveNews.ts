import { askGemini } from './gemini';

// ---------------------------------------------------------------------------
// RSS Sources
// ---------------------------------------------------------------------------

// Per-category feeds (used for World, America, Europe, etc.)
const CATEGORY_FEEDS: Record<string, string[]> = {
  World: [
    'http://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    'https://www.france24.com/en/rss',
  ],
  America: [
    'https://rss.nytimes.com/services/xml/rss/nyt/US.xml',
    'https://feeds.npr.org/1001/rss.xml',
    'http://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml',
  ],
  Europe: [
    'https://www.france24.com/en/europe/rss',
    'http://feeds.bbci.co.uk/news/world/europe/rss.xml',
  ],
  India: [
    'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
    'https://feeds.feedburner.com/ndtvnews-india-news',
  ],
  Sports: [
    'http://feeds.bbci.co.uk/sport/rss.xml',
    'https://www.espn.com/espn/rss/news',
  ],
  Tech: [
    'https://techcrunch.com/feed/',
    'https://www.theverge.com/rss/index.xml',
    'https://feeds.arstechnica.com/arstechnica/index',
  ],
};

// Broad set of feeds — fetched for AI-curated categories (Leaders, Blind Spot, Search, Local)
const BROAD_FEEDS = [
  'http://feeds.bbci.co.uk/news/world/rss.xml',
  'https://www.aljazeera.com/xml/rss/all.xml',
  'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
  'https://rss.nytimes.com/services/xml/rss/nyt/US.xml',
  'https://www.france24.com/en/rss',
  'https://feeds.npr.org/1001/rss.xml',
  'https://feeds.npr.org/1004/rss.xml',
  'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
  'https://techcrunch.com/feed/',
  'http://feeds.bbci.co.uk/sport/rss.xml',
  'http://feeds.bbci.co.uk/news/world/europe/rss.xml',
  'http://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml',
  'http://feeds.bbci.co.uk/news/world/asia/rss.xml',
  'https://www.theguardian.com/world/rss',
  'https://www.theguardian.com/us-news/rss',
];

// Keywords for client-side pre-filtering (avoids AI for Leaders category)
const LEADER_KEYWORDS = [
  'president', 'prime minister', 'chancellor', 'minister', 'senator',
  'secretary of state', 'summit', 'g7', 'g20', 'nato', 'un ', 'diplomat',
  'white house', 'kremlin', 'parliament', 'congress', 'biden', 'trump',
  'modi', 'macron', 'putin', 'xi jinping', 'sunak', 'zelensky', 'netanyahu',
  'leader', 'election', 'vote', 'policy', 'government',
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

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isRecent(pubDate: string): boolean {
  const t = new Date(pubDate).getTime();
  return isNaN(t) || Date.now() - t <= ONE_WEEK_MS;
}

/** Fetch one RSS feed. Returns [] on timeout / error. */
async function fetchOneFeed(rssUrl: string, labelCategory: string): Promise<LiveArticle[]> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(
      `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`,
      { signal: ctrl.signal }
    );
    clearTimeout(timer);
    const data = await res.json();
    if (data.status !== 'ok') return [];

    return data.items
      .filter((item: any) => item.title && isRecent(item.pubDate))
      .map((item: any, idx: number) => ({
        id: `${Math.random().toString(36).substr(2, 9)}-${idx}`,
        title: item.title.trim(),
        link: item.link || '#',
        pubDate: item.pubDate,
        source: data.feed.title || labelCategory,
        image:
          item.enclosure?.link ||
          item.thumbnail ||
          `https://picsum.photos/seed/${encodeURIComponent(labelCategory + idx)}/600/400.webp`,
        summary:
          item.description?.replace(/<[^>]*>?/gm, '').substring(0, 220).trim() + '...' || '',
        content: item.content || item.description || '',
      }));
  } catch {
    return [];
  }
}

/** Fetch many feeds in parallel, deduplicate by title, keep last-7-days only */
async function fetchFeeds(urls: string[], label: string): Promise<LiveArticle[]> {
  const results = await Promise.all(urls.map(u => fetchOneFeed(u, label)));
  const flat = results.flat();
  const seen = new Set<string>();
  return flat.filter(a => {
    const key = a.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// AI-assisted selection: AI picks indices from REAL fetched articles.
// AI never generates article text — it only curates what was actually fetched.
// ---------------------------------------------------------------------------
async function aiSelectArticles(
  articles: LiveArticle[],
  selectionGoal: string,
  count = 8
): Promise<LiveArticle[]> {
  if (articles.length === 0) return [];
  if (articles.length <= count) return articles;

  // Build a numbered list of just titles + sources for the AI
  const numbered = articles
    .slice(0, 60) // cap to avoid token overflow
    .map((a, i) => `[${i}] ${a.source}: ${a.title}`)
    .join('\n');

  const prompt = `You are a news editor. Below are real news articles just fetched from live RSS feeds.

${numbered}

Task: ${selectionGoal}

Return ONLY a JSON array of up to ${count} article indices (numbers) from the list above, ordered by relevance. Example: [3, 11, 0, 24, 7]
Do NOT explain anything. Do NOT generate new articles. ONLY return the JSON array of indices.`;

  try {
    const raw = await askGemini(prompt);
    const match = raw.match(/\[[\d,\s]+\]/);
    if (!match) throw new Error('No array found');
    const indices: number[] = JSON.parse(match[0]);
    const selected = indices
      .filter(i => typeof i === 'number' && i >= 0 && i < articles.length)
      .slice(0, count)
      .map(i => articles[i]);
    if (selected.length > 0) return selected;
  } catch (e) {
    console.warn('AI selection failed, using keyword/date fallback', e);
  }
  return articles.slice(0, count);
}

// ---------------------------------------------------------------------------
// Public fetch function
// ---------------------------------------------------------------------------
export async function fetchLiveNews(category: string, query?: string): Promise<LiveArticle[]> {
  try {
    // ── AI-curated categories ──────────────────────────────────────────────
    if (category === 'Leaders') {
      // Fetch broadly, then keyword-filter for leadership content
      const all = await fetchFeeds(BROAD_FEEDS, 'World News');
      const leaderArticles = all.filter(a => {
        const text = (a.title + ' ' + a.summary).toLowerCase();
        return LEADER_KEYWORDS.some(kw => text.includes(kw));
      });
      // If enough match via keywords, return directly (no AI needed)
      if (leaderArticles.length >= 5) {
        return shuffle(leaderArticles).slice(0, 10);
      }
      // Otherwise let AI pick from the broad pool
      return aiSelectArticles(
        all,
        'Select articles specifically about world leaders, presidents, prime ministers, government heads, diplomatic summits, or major political decisions.',
        8
      );
    }

    if (category === 'Blind Spot') {
      const all = await fetchFeeds(BROAD_FEEDS, 'World News');
      return aiSelectArticles(
        all,
        'Select articles that are critically important but appear to be UNDERREPORTED — stories that deserve more attention, "blind spots" in mainstream coverage, or overlooked global crises.',
        8
      );
    }

    if (category === 'Local' || query) {
      const searchTerm = query || 'India local news';
      // Fetch from broad feeds + try India-specific ones
      const feeds = [...BROAD_FEEDS];
      if (category === 'Local' || searchTerm.toLowerCase().includes('india')) {
        feeds.push('https://timesofindia.indiatimes.com/rssfeedstopstories.cms');
      }
      const all = await fetchFeeds(feeds, 'Local News');

      // Client-side keyword filter first
      const kw = searchTerm.toLowerCase().split(' ').filter(w => w.length > 3);
      const matched = all.filter(a => {
        const text = (a.title + ' ' + a.summary).toLowerCase();
        return kw.some(w => text.includes(w));
      });

      if (matched.length >= 5) return shuffle(matched).slice(0, 10);

      return aiSelectArticles(
        all,
        `Select articles most relevant to the search topic: "${searchTerm}". Include any closely related regional or subject-matter news.`,
        8
      );
    }

    // ── Standard RSS categories ────────────────────────────────────────────
    const urls = CATEGORY_FEEDS[category] || CATEGORY_FEEDS['World'];
    const articles = await fetchFeeds(urls, category);
    return shuffle(articles);

  } catch (e) {
    console.error('fetchLiveNews error', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Full article scraper (proxy chain)
// ---------------------------------------------------------------------------
export async function scrapeFullArticle(url: string): Promise<string> {
  if (!url || url === '#') return '';
  try {
    let html = '';

    try {
      const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`);
      if (res.ok) html = await res.text();
    } catch {}

    if (!html || html.includes('Cloudflare') || html.includes('captcha')) {
      try {
        const res2 = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
        const data = await res2.json();
        html = data.contents;
      } catch {}
    }

    if (!html || html.includes('Cloudflare') || html.includes('captcha')) {
      return 'The news source is heavily protected (Cloudflare/Paywall). Cannot extract full article.';
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,nav,header,footer,iframe,form,button,aside,.ad,.advertisement').forEach(el => el.remove());

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
      return container.textContent?.replace(/\s+/g, ' ').trim() || 'Failed to extract content.';
    }
    return paragraphs.join('\n\n');
  } catch (e) {
    console.error(e);
    return 'Error fetching the full story from the original source.';
  }
}
