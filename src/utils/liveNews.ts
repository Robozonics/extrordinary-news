import { askGemini } from './gemini';

// ---------------------------------------------------------------------------
// RSS Sources
// ---------------------------------------------------------------------------
const CATEGORY_FEEDS: Record<string, string[]> = {
  World: [
    'http://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    'https://www.france24.com/en/rss',
    'https://www.theguardian.com/world/rss',
    'http://rss.cnn.com/rss/edition_world.rss',
    'https://moxie.foxnews.com/google-publisher/world.xml',
  ],
  America: [
    'https://rss.nytimes.com/services/xml/rss/nyt/US.xml',
    'https://feeds.npr.org/1001/rss.xml',
    'http://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml',
    'http://rss.cnn.com/rss/edition_us.rss',
    'https://www.wsj.com/xml/rss/3_7085.xml',
    'https://moxie.foxnews.com/google-publisher/politics.xml',
  ],
  Europe: [
    'https://www.france24.com/en/europe/rss',
    'http://feeds.bbci.co.uk/news/world/europe/rss.xml',
    'https://www.theguardian.com/europe/rss',
  ],
  India: [
    'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
    'https://feeds.feedburner.com/ndtvnews-india-news',
    'https://www.thehindu.com/news/national/feeder/default.rss',
  ],
  Sports: [
    'http://feeds.bbci.co.uk/sport/rss.xml',
    'https://www.espn.com/espn/rss/news',
    'https://www.cbssports.com/rss/headlines/',
    'https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml',
  ],
  Tech: [
    'https://techcrunch.com/feed/',
    'https://www.theverge.com/rss/index.xml',
    'https://feeds.arstechnica.com/arstechnica/index',
    'https://www.wired.com/feed/rss',
    'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
  ],
};

const BROAD_FEEDS = [
  'http://feeds.bbci.co.uk/news/world/rss.xml',
  'https://www.aljazeera.com/xml/rss/all.xml',
  'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
  'https://rss.nytimes.com/services/xml/rss/nyt/US.xml',
  'https://www.france24.com/en/rss',
  'https://feeds.npr.org/1001/rss.xml',
  'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
  'https://techcrunch.com/feed/',
  'http://feeds.bbci.co.uk/sport/rss.xml',
  'https://www.theguardian.com/world/rss',
  'https://www.theguardian.com/us-news/rss',
  'http://rss.cnn.com/rss/edition_world.rss',
  'http://rss.cnn.com/rss/edition_us.rss',
  'https://www.wsj.com/xml/rss/3_7085.xml',
  'https://moxie.foxnews.com/google-publisher/world.xml',
  'https://www.wired.com/feed/rss',
];

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

// ---------------------------------------------------------------------------
// Core RSS fetcher (single feed via rss2json proxy)
// ---------------------------------------------------------------------------
async function fetchOneFeed(rssUrl: string, labelCategory: string): Promise<LiveArticle[]> {
  const urls = [
    `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`,
    `https://feed2json.org/convert?url=${encodeURIComponent(rssUrl)}`
  ];

  for (const url of urls) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      
      if (!res.ok) continue;
      
      const data = await res.json();
      if (data.status === 'ok' || data.items) {
        const items = data.items || [];
        const feedTitle = data.feed?.title || data.title || labelCategory;
        
        const mapped = items
          .filter((item: any) => item.title && isRecent(item.pubDate || item.date_published || ''))
          .map((item: any, idx: number) => {
            const pubDate = item.pubDate || item.date_published || '';
            const link = item.link || item.url || '#';
            const description = item.description || item.summary || item.content_html || '';
            const content = item.content || item.content_text || description;
            const rawImg = item.enclosure?.link || item.thumbnail || item.image || `https://picsum.photos/seed/${encodeURIComponent(labelCategory + idx)}/800/500`;
            const optimizedImg = `https://wsrv.nl/?url=${encodeURIComponent(rawImg)}&w=800&output=webp&q=80&fit=cover`;
            
            return {
              id: `${Math.random().toString(36).substr(2, 9)}-${idx}`,
              title: item.title.trim(),
              link: link,
              pubDate: pubDate,
              source: feedTitle,
              image: optimizedImg,
              summary: description.replace(/<[^>]*>?/gm, '').substring(0, 220).trim() + '...' || '',
              content: content || '',
            };
          });
        
        if (mapped.length > 0) return mapped;
      }
    } catch {
      // try next url
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Google News RSS Search — the KEY to getting REAL current results for any query.
// URL format: https://news.google.com/rss/search?q=QUERY&hl=en&gl=US&ceid=US:en
// This is a free, public RSS feed — no API key needed.
// ---------------------------------------------------------------------------
async function searchGoogleNews(query: string): Promise<LiveArticle[]> {
  // Google News RSS for the query (when=7d restricts to last 7 days)
  const gnewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' when:7d')}&hl=en&gl=US&ceid=US:en`;
  console.info(`🔍 Searching Google News RSS for: "${query}"`);

  const articles = await fetchOneFeed(gnewsUrl, 'Google News');

  // Also try Bing News RSS as backup
  const bingUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`;
  const bingArticles = await fetchOneFeed(bingUrl, 'Bing News');

  const all = [...articles, ...bingArticles];

  // Deduplicate by title similarity
  const seen = new Set<string>();
  return all.filter(a => {
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Fetch many feeds in parallel, deduplicate */
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
// AI-assisted selection: picks indices from REAL fetched articles only.
// ---------------------------------------------------------------------------
async function aiSelectArticles(
  articles: LiveArticle[],
  selectionGoal: string,
  count = 8
): Promise<LiveArticle[]> {
  if (articles.length === 0) return [];
  if (articles.length <= count) return articles;

  const numbered = articles
    .slice(0, 60)
    .map((a, i) => `[${i}] ${a.source}: ${a.title}`)
    .join('\n');

  const prompt = `You are a news editor. Below are real news articles just fetched from live RSS feeds.

${numbered}

Task: ${selectionGoal}

CRITICAL RULES:
- Return ONLY a JSON array of article indices (numbers) from the list above.
- Do NOT write explanations. Do NOT generate new content. Do NOT apologize.
- Do NOT say you don't have internet access. These articles ARE real and current.
- Example response: [3, 11, 0, 24, 7]
- Pick up to ${count} articles.`;

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
    console.warn('AI selection failed, using fallback', e);
  }
  return articles.slice(0, count);
}

// ---------------------------------------------------------------------------
// Public fetch function
// ---------------------------------------------------------------------------
export async function fetchLiveNews(category: string, query?: string): Promise<LiveArticle[]> {
  try {
    // ── Search query → Use Google News RSS (returns REAL current articles) ──
    if (query) {
      // 1. Search Google News + Bing News for the exact query
      const searchResults = await searchGoogleNews(query);

      if (searchResults.length > 0) {
        console.info(`✅ Found ${searchResults.length} real articles for "${query}"`);
        return searchResults.slice(0, 15);
      }

      // 2. If Google/Bing returned nothing, try broad feeds + keyword filter
      console.warn(`⚠️ Google News returned 0 results for "${query}", trying broad feeds...`);
      const broadAll = await fetchFeeds(BROAD_FEEDS, 'News');
      const kw = query.toLowerCase().split(' ').filter(w => w.length > 2);
      const matched = broadAll.filter(a => {
        const text = (a.title + ' ' + a.summary).toLowerCase();
        return kw.some(w => text.includes(w));
      });
      if (matched.length > 0) return shuffle(matched).slice(0, 10);

      // 3. Last resort: return broad news with a console warning
      console.warn(`⚠️ No articles found matching "${query}" in any source`);
      return shuffle(broadAll).slice(0, 10);
    }

    // ── Leaders ────────────────────────────────────────────────────────────
    if (category === 'Leaders') {
      // First try Google News search for world leaders
      const leaderSearch = await searchGoogleNews('world leaders summit president prime minister');
      if (leaderSearch.length >= 5) {
        return leaderSearch.slice(0, 10);
      }

      // Fallback: broad feeds + keyword filter
      const all = await fetchFeeds(BROAD_FEEDS, 'World News');
      const leaderArticles = all.filter(a => {
        const text = (a.title + ' ' + a.summary).toLowerCase();
        return LEADER_KEYWORDS.some(kw => text.includes(kw));
      });
      if (leaderArticles.length >= 5) return shuffle(leaderArticles).slice(0, 10);

      return aiSelectArticles(
        all,
        'Select articles specifically about world leaders, presidents, prime ministers, government heads, diplomatic summits, or major political decisions.',
        8
      );
    }

    // ── Blind Spot ─────────────────────────────────────────────────────────
    if (category === 'Blind Spot') {
      const all = await fetchFeeds(BROAD_FEEDS, 'World News');
      return aiSelectArticles(
        all,
        'Select articles that are critically important but appear to be UNDERREPORTED — stories that deserve more attention, "blind spots" in mainstream coverage, or overlooked global crises.',
        8
      );
    }

    // ── Local ──────────────────────────────────────────────────────────────
    if (category === 'Local') {
      // Use Google News for local/India news
      const localResults = await searchGoogleNews('India news today');
      if (localResults.length > 0) return localResults.slice(0, 12);

      // Fallback to India RSS feeds
      const indiaFeeds = CATEGORY_FEEDS['India'] || [];
      const articles = await fetchFeeds(indiaFeeds, 'India');
      return shuffle(articles);
    }

    // ── Standard RSS categories (World, America, Europe, Sports, Tech) ────
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
      const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        html = data.contents;
      }
    } catch {}

    if (!html || html.includes('Cloudflare') || html.includes('captcha')) {
      try {
        const res2 = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`);
        if (res2.ok) html = await res2.text();
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
