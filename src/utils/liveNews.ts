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

const TAMIL_FEEDS = [
  'https://tamil.oneindia.com/rss/tamil-news-fb.xml',
  'https://tamil.samayam.com/rssfeeds/47344932.cms',
  'https://www.hindutamil.in/rss/tamilnadu',
  'https://tamil.news18.com/rss/tamil-nadu.xml',
  'https://www.dinamalar.com/rss_main.asp',
  'https://tamil.asianetnews.com/rss/tamilnadu',
  'https://www.dailythanthi.com/rss',
  'https://tamil.abplive.com/home/feed',
  'https://www.polimernews.com/rss'
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

function isRecent(pubDate: string, maxDays: number = 7): boolean {
  const t = new Date(pubDate).getTime();
  return isNaN(t) || Date.now() - t <= maxDays * 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// In-memory feed cache (avoids duplicate requests within same session)
// ---------------------------------------------------------------------------
const feedCache = new Map<string, { data: LiveArticle[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Parse raw RSS/Atom XML into LiveArticle[]
// ---------------------------------------------------------------------------
function parseXmlFeed(xmlText: string, labelCategory: string, maxDays: number): LiveArticle[] {
  if (!xmlText || (!xmlText.includes('<rss') && !xmlText.includes('<feed'))) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  
  const feedTitle = doc.querySelector('channel > title, feed > title')?.textContent || labelCategory;
  const items = Array.from(doc.querySelectorAll('item, entry'));
  
  return items.map((el, idx) => {
    const title = el.querySelector('title')?.textContent || '';
    let link = el.querySelector('link')?.textContent || '';
    if (!link) {
      const linkEl = el.querySelector('link');
      if (linkEl) link = linkEl.getAttribute('href') || '';
    }
    
    const pubDate = el.querySelector('pubDate, published, updated')?.textContent || '';
    const description = el.querySelector('description, summary, content')?.textContent || '';
    
    let rawImg = '';
    const enclosure = el.querySelector('enclosure[type^="image"]');
    if (enclosure) rawImg = enclosure.getAttribute('url') || '';
    if (!rawImg) {
      const media = el.getElementsByTagName('media:content')[0];
      if (media) rawImg = media.getAttribute('url') || '';
    }
    if (!rawImg) {
      const thumb = el.getElementsByTagName('media:thumbnail')[0];
      if (thumb) rawImg = thumb.getAttribute('url') || '';
    }
    if (!rawImg) {
      rawImg = `https://picsum.photos/seed/${encodeURIComponent(labelCategory + idx)}/800/500`;
    }

    const optimizedImg = `https://wsrv.nl/?url=${encodeURIComponent(rawImg)}&w=800&output=webp&q=80&fit=cover`;

    return {
      id: `${Math.random().toString(36).substr(2, 9)}-${idx}`,
      title: title.trim(),
      link: link.trim(),
      pubDate,
      source: feedTitle.trim(),
      image: optimizedImg,
      summary: description.replace(/<[^>]*>?/gm, '').substring(0, 220).trim() + '...' || '',
      content: description || '',
    };
  }).filter(item => item.title && isRecent(item.pubDate, maxDays));
}

// ---------------------------------------------------------------------------
// Single proxy fetch helper (returns articles or throws)
// ---------------------------------------------------------------------------
async function fetchViaProxy(
  proxyUrl: string, 
  isJson: boolean, 
  labelCategory: string, 
  maxDays: number
): Promise<LiveArticle[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(proxyUrl, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`${res.status}`);
    
    let xmlText: string;
    if (isJson) {
      const data = await res.json();
      xmlText = data.contents;
    } else {
      xmlText = await res.text();
    }

    const articles = parseXmlFeed(xmlText, labelCategory, maxDays);
    if (articles.length === 0) throw new Error('No articles parsed');
    return articles;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Core RSS fetcher — races ALL proxies in parallel for maximum speed
// ---------------------------------------------------------------------------
async function fetchOneFeed(rssUrl: string, labelCategory: string, maxDays: number = 7): Promise<LiveArticle[]> {
  // Check cache first
  const cacheKey = `${rssUrl}|${maxDays}`;
  const cached = feedCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  // Build all proxy attempts
  const attempts: Promise<LiveArticle[]>[] = [
    // rss2json (JSON API)
    (async () => {
      const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        if (data.status !== 'ok' && !data.items) throw new Error('bad response');
        const items = data.items || [];
        const feedTitle = data.feed?.title || data.title || labelCategory;
        const mapped = items
          .filter((item: any) => item.title && isRecent(item.pubDate || item.date_published || '', maxDays))
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
              link, pubDate, source: feedTitle,
              image: optimizedImg,
              summary: description.replace(/<[^>]*>?/gm, '').substring(0, 220).trim() + '...' || '',
              content: content || '',
            };
          });
        if (mapped.length === 0) throw new Error('No articles');
        return mapped;
      } catch (e) { clearTimeout(timer); throw e; }
    })(),
    // allorigins (JSON wrapper)
    fetchViaProxy(
      `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`,
      true, labelCategory, maxDays
    ),
    // thingproxy (raw)
    fetchViaProxy(
      `https://thingproxy.freeboard.io/fetch/${rssUrl}`,
      false, labelCategory, maxDays
    ),
    // codetabs (raw)
    fetchViaProxy(
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(rssUrl)}`,
      false, labelCategory, maxDays
    ),
  ];

  try {
    const result = await Promise.any(attempts);
    feedCache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Google News RSS Search — the KEY to getting REAL current results for any query.
// URL format: https://news.google.com/rss/search?q=QUERY&hl=en&gl=US&ceid=US:en
// This is a free, public RSS feed — no API key needed.
// ---------------------------------------------------------------------------
async function searchGoogleNews(query: string, maxDays: number = 7): Promise<LiveArticle[]> {
  // Google News RSS for the query
  const gnewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ` when:${maxDays}d`)}&hl=en&gl=US&ceid=US:en`;
  console.info(`🔍 Searching Google News RSS for: "${query}"`);

  const articles = await fetchOneFeed(gnewsUrl, 'Google News', maxDays);

  // Also try Bing News RSS as backup
  const bingUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`;
  const bingArticles = await fetchOneFeed(bingUrl, 'Bing News', maxDays);

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
async function fetchFeeds(urls: string[], label: string, maxDays: number = 7): Promise<LiveArticle[]> {
  const results = await Promise.all(urls.map(u => fetchOneFeed(u, label, maxDays)));
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

    // ── CM Vijay ───────────────────────────────────────────────────────────
    if (category === 'CM Vijay') {
      // Fetch Tamil feeds and Google News in parallel — don't wait for one to finish
      const [tamilAll, gnewsResults] = await Promise.all([
        fetchFeeds(TAMIL_FEEDS, 'Tamil News', 5),
        searchGoogleNews('Tamilnadu CM Vijay', 5).catch(() => [] as LiveArticle[])
      ]);

      const keywords = ['விஜய்', 'vijay', 'tvk', 'தமிழக', 'முதல்வர்', 'cm ', 'chief minister'];
      const tamilFiltered = tamilAll.filter(a => {
        const text = (a.title + ' ' + a.summary).toLowerCase();
        return keywords.some(k => text.includes(k));
      });

      // Tamil feeds first, then Google News results
      const combined = [...tamilFiltered, ...gnewsResults];
      
      // If we got enough from Tamil feeds alone, return immediately
      if (combined.length >= 3) {
        return shuffle(combined).slice(0, 15);
      }
      
      // If very few results, just return all Tamil news (unfiltered) as fallback
      if (tamilAll.length > 0) {
        return shuffle(tamilAll).slice(0, 15);
      }

      return combined.slice(0, 15);
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
