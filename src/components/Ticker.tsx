import { useState, useEffect, useRef } from 'react';

const RSS_URLS = [
  'http://feeds.bbci.co.uk/news/world/rss.xml',
  'https://www.aljazeera.com/xml/rss/all.xml',
  'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
];

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // refresh every 5 minutes
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

async function fetchTickerHeadlines(): Promise<string[]> {
  const results: string[] = [];
  const now = Date.now();

  await Promise.all(
    RSS_URLS.map(async (rssUrl) => {
      try {
        const { fetchOneFeed } = await import('../utils/liveNews');
        const articles = await fetchOneFeed(rssUrl, 'Ticker', 7);
        articles.slice(0, 5).forEach(article => {
          results.push(article.title.toUpperCase());
        });
      } catch (e) {
        console.warn('Ticker failed for url:', rssUrl);
      }
    })
  );

  // Shuffle so it doesn't always lead with the same source
  for (let i = results.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [results[i], results[j]] = [results[j], results[i]];
  }

  return results.length > 0 ? results : ['LOADING LATEST WORLD NEWS...'];
}

export default function Ticker() {
  const [headlines, setHeadlines] = useState<string[]>(['FETCHING LIVE HEADLINES...']);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = async () => {
    const fresh = await fetchTickerHeadlines();
    setHeadlines(fresh);
  };

  useEffect(() => {
    refresh(); // fetch immediately on mount
    intervalRef.current = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Build the ticker text: titles separated by a bullet
  const tickerText = headlines.join('  •  ');
  // Duplicate so marquee loops seamlessly
  const display = `${tickerText}  •  ${tickerText}`;

  // Dynamic duration based on content length (longer = slower, min 30s, max 90s)
  const durationSec = Math.max(30, Math.min(90, Math.round(display.length * 0.08)));

  return (
    <div className="bg-red-600 text-white font-mono text-sm py-1 overflow-hidden whitespace-nowrap flex items-center border-b-2 border-black z-50 relative">
      {/* Badge */}
      <div className="bg-black text-red-500 font-bold px-3 py-1 uppercase z-10 flex items-center gap-2 shrink-0 shadow-[2px_0_0_#dc2626]">
        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        BREAKING NEWS
      </div>

      {/* Scrolling band */}
      <div className="overflow-hidden flex-1 relative">
        <div
          key={tickerText} // re-trigger animation when headlines refresh
          className="inline-block animate-marquee-live"
          style={{ animationDuration: `${durationSec}s` }}
        >
          {display}
        </div>
      </div>

      <style>{`
        @keyframes marquee-live {
          0%   { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee-live {
          animation: marquee-live linear infinite;
          white-space: nowrap;
          padding-left: 1rem;
        }
      `}</style>
    </div>
  );
}
