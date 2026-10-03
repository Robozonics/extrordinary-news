import { useState, useEffect, useRef } from 'react';
import { fetchLiveNews } from '../utils/liveNews';
import type { LiveArticle } from '../utils/liveNews';
import { MapPin, RefreshCw, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';

export default function BroadsheetMode() {
  const [pages, setPages] = useState<Record<string, LiveArticle[]>>({});
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState("Local Region");
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const minSwipeDistance = 90; 

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].clientX;
    touchStartY.current = e.changedTouches[0].clientY;
  };
  
  const onTouchEndHandler = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const distanceX = touchStartX.current - touchEndX;
    const distanceY = touchStartY.current - touchEndY;
    
    // Only register as swipe if the horizontal movement is greater than vertical movement
    if (Math.abs(distanceX) > Math.abs(distanceY)) {
      if (distanceX > minSwipeDistance && currentPageIndex < pageOrder.length - 1) {
        setCurrentPageIndex(p => p + 1);
        window.scrollTo(0,0);
      } else if (distanceX < -minSwipeDistance && currentPageIndex > 0) {
        setCurrentPageIndex(p => p - 1);
        window.scrollTo(0,0);
      }
    }
    
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const pageOrder = ['Front Page', 'Global Leaders', 'National News', 'Local News', 'World News', 'Technology', 'Sports'];

  const loadPaper = async () => {
    setLoading(true);
    
    let localQuery = "Local News";
    if ('geolocation' in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        localQuery = `news near ${pos.coords.latitude},${pos.coords.longitude}`;
        setLocationName("Your Local Edition");
      } catch (e) {
        console.warn("Location denied");
      }
    }

    const [nat, loc, wrld, tech, spt, leaders] = await Promise.all([
      fetchLiveNews("India"),
      fetchLiveNews("Local", localQuery),
      fetchLiveNews("World"),
      fetchLiveNews("Tech"),
      fetchLiveNews("Sports"),
      fetchLiveNews("Leaders")
    ]);

    setPages({
      'Front Page': [nat[0], leaders[0], wrld[0], loc[0], tech[0], spt[0]].filter(Boolean),
      'Global Leaders': leaders.slice(1),
      'National News': nat.slice(1),
      'Local News': loc.slice(1),
      'World News': wrld.slice(1),
      'Technology': tech.slice(1),
      'Sports': spt.slice(1)
    });
    
    setLoading(false);
  };

  useEffect(() => {
    loadPaper();
  }, []);

  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-paper-bg flex flex-col justify-center items-center text-paper-ink">
        <Loader2 className="animate-spin mb-4" size={48} />
        <h1 className="font-serif font-black text-3xl">Printing The Morning Edition...</h1>
      </div>
    );
  }

  const currentPageName = pageOrder[currentPageIndex];
  const currentArticles = pages[currentPageName] || [];
  const leadStory = currentArticles[0];
  const sideStories = currentArticles.slice(1);

  return (
    <div 
      className="min-h-screen bg-paper-bg text-black font-serif pb-32 overflow-x-hidden selection:bg-black selection:text-white"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEndHandler}
    >
      <div className="fixed inset-0 pointer-events-none opacity-40 z-0 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] mix-blend-multiply" />
      
      {/* Newspaper Pagination Controls (Moved to Top) */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center font-mono text-[10px] md:text-sm uppercase font-bold bg-white/95 backdrop-blur-md px-2 md:px-6 py-2 md:py-4 border-b-[3px] md:border-b-4 border-paper-ink shadow-[0_10px_20px_rgba(0,0,0,0.1)]">
        <button disabled={currentPageIndex === 0} onClick={() => { setCurrentPageIndex(p => p - 1); window.scrollTo(0,0); }} className="hover:bg-black hover:text-white disabled:opacity-30 flex items-center justify-center gap-1 md:gap-2 px-3 py-2 md:px-4 md:py-2 border-2 border-transparent hover:border-black transition-all rounded-lg active:bg-black active:text-white">
          <ChevronLeft size={20}/> <span className="text-xs md:text-sm">PREV</span>
        </button>
        
        <span className="text-center flex-1 truncate px-2 leading-tight">Page {currentPageIndex + 1} of {pageOrder.length} <br className="md:hidden"/> <span className="hidden md:inline">—</span> {currentPageName}</span>
        
        <button disabled={currentPageIndex === pageOrder.length - 1} onClick={() => { setCurrentPageIndex(p => p + 1); window.scrollTo(0,0); }} className="hover:bg-black hover:text-white disabled:opacity-30 flex items-center justify-center gap-1 md:gap-2 px-3 py-2 md:px-4 md:py-2 border-2 border-transparent hover:border-black transition-all rounded-lg active:bg-black active:text-white">
          <span className="text-xs md:text-sm">NEXT</span> <ChevronRight size={20}/>
        </button>
      </div>

      <main className="max-w-7xl mx-auto p-4 md:p-8 pt-20 md:pt-24 relative z-10 overflow-x-hidden">
        
        {/* Masthead (Only on Front Page) */}
        {currentPageIndex === 0 && (
          <header className="border-b-[6px] border-paper-ink pb-4 md:pb-6 mb-6 md:mb-8 text-center relative">
            <div className="absolute top-0 left-0 text-xs font-bold uppercase tracking-widest hidden md:block">Vol. CXXIV No. 42</div>
            <div className="absolute top-0 right-0 text-xs font-bold uppercase tracking-widest hidden md:block">
              <button onClick={loadPaper} className="flex items-center gap-1 hover:underline"><RefreshCw size={12}/> Late Edition</button>
            </div>
            <h1 className="text-[64px] sm:text-[80px] md:text-[120px] lg:text-[140px] mt-4 md:mt-6 mb-2 md:mb-4 leading-none text-center" style={{fontFamily: "'UnifrakturMaguntia', cursive"}}>
              The Extraordinary Times
            </h1>
            <div className="flex justify-between items-center border-t-2 border-b-2 border-paper-ink py-2 mt-4 text-[10px] md:text-sm font-bold uppercase tracking-wider">
              <span className="truncate">India's National Newspaper</span>
              <span className="hidden sm:block">{today}</span>
              <span>₹ 5.00</span>
            </div>
          </header>
        )}

        {/* Page Header (For other pages) */}
        {currentPageIndex !== 0 && (
          <header className="border-b-[4px] border-paper-ink pb-3 md:pb-4 mb-4 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-1 md:gap-2">
            <h2 className="text-5xl sm:text-6xl md:text-8xl leading-none break-words" style={{fontFamily: "'UnifrakturMaguntia', cursive"}}>{currentPageName}</h2>
            <span className="font-bold uppercase text-[10px] md:text-sm md:border-l-2 border-paper-ink md:pl-4">{today} — Page {currentPageIndex + 1}</span>
          </header>
        )}

        {/* Content Layout */}
        <div className="flex flex-col lg:flex-row gap-6 md:gap-8">
          
          {/* Main Column */}
          <div className="lg:w-2/3 lg:border-r-[2px] border-paper-ink lg:pr-8">
             {leadStory ? (
               <article className="mb-8 md:mb-12 border-b-[2px] border-paper-ink pb-6 lg:border-none lg:pb-0">
                 <h2 className="text-3xl sm:text-4xl md:text-6xl font-black leading-tight md:leading-none mb-4 md:mb-6 tracking-tight hover:underline cursor-pointer" style={{fontFamily: "'Playfair Display', serif"}}>
                   {leadStory.title}
                 </h2>
                 <div className="flex gap-4 items-end mb-4">
                   <div className="text-xs md:text-sm font-bold uppercase tracking-widest border-b-[2px] border-paper-ink pb-1">By {leadStory.source}</div>
                 </div>
                 <img src={leadStory.image} alt="Lead story" className="w-full aspect-video md:h-[500px] lg:h-[600px] object-cover mb-4 md:mb-6 border-[2px] md:border-[3px] border-paper-ink p-1 vintage-img" />
                 <p className="text-base sm:text-lg md:text-xl leading-relaxed drop-cap first-letter:text-5xl md:first-letter:text-7xl first-letter:float-left first-letter:mr-2 md:first-letter:mr-4 first-letter:mt-1 md:first-letter:mt-2 text-left md:text-justify md:columns-2 gap-6 md:gap-8 font-serif" style={{fontFamily: "'Merriweather', serif"}}>
                   {leadStory.summary} {leadStory.content?.replace(/<[^>]*>?/gm, '').substring(0, 1000)}...
                 </p>
               </article>
             ) : (
               <p className="text-lg md:text-xl font-bold italic border-[2px] border-paper-ink p-6 md:p-8 text-center">No major stories to report in this section today.</p>
             )}
          </div>

          {/* Right Sidebar */}
          <aside className="lg:w-1/3 flex flex-col gap-6 md:gap-8">
            {sideStories.map((story, i) => (
              <article key={i} className="border-b-[2px] border-gray-400 pb-5 md:pb-6 last:border-none">
                {i % 2 === 0 && <img src={story.image} loading="lazy" className="w-full aspect-video md:h-56 object-cover mb-3 md:mb-4 border-[2px] border-paper-ink p-1 vintage-img" alt=""/>}
                <h4 className="font-black text-2xl sm:text-3xl leading-tight mb-2 md:mb-3 hover:underline cursor-pointer break-words" style={{fontFamily: "'Playfair Display', serif"}}>{story.title}</h4>
                <p className="text-sm md:text-base text-black text-left md:text-justify leading-snug font-serif" style={{fontFamily: "'Merriweather', serif"}}>{story.summary}</p>
                <div className="text-[10px] md:text-xs font-bold uppercase mt-2 md:mt-3 text-black border-t border-gray-300 pt-2">— {story.source}</div>
              </article>
            ))}
          </aside>

        </div>
      </main>
    </div>
  );
}
