import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchLiveNews, scrapeFullArticle, getCityName } from '../utils/liveNews';
import type { LiveArticle } from '../utils/liveNews';
import { translateWithGemini, factCheckWithGemini, askGemini } from '../utils/gemini';
import ShareMenu from './ShareMenu';
import { Globe, Play, Pause, Bookmark, ShieldAlert, Loader2, Volume2, Search, MapPin, Maximize2, X, RefreshCw, Eye, BookOpen, Brain, Scale, Wallet, Sparkles, Mic, Settings, Share2 } from 'lucide-react';

interface Props {
  view: 'feed' | 'inshorts' | 'saved' | 'factcheck';
  setMode?: (m: 'cyber' | 'broadsheet' | 'inshorts' | 'saved' | 'factcheck') => void;
  onArticlesUpdate?: (articles: LiveArticle[]) => void;
}

const CATEGORIES = ['World', 'India', 'Leaders', 'Local', 'Blind Spot', 'Tech', 'America', 'Europe', 'Sports'] as const;
type Category = typeof CATEGORIES[number];

export default function CyberMode({ view, setMode, onArticlesUpdate }: Props) {
  const [category, setCategory] = useState<Category>('World');
  const [articles, setArticles] = useState<LiveArticle[]>([]);
  const [saved, setSaved] = useState<LiveArticle[]>(() => {
    try {
      const item = window.localStorage.getItem('saved_articles');
      return item ? JSON.parse(item) : [];
    } catch (e) {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const [fullStoryId, setFullStoryId] = useState<string | null>(null);
  const [fullStoryContent, setFullStoryContent] = useState('');
  const [isFullStoryLoading, setIsFullStoryLoading] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState<string | null>(null);
  const SUPPORTED_LANGUAGES = ['English', 'Tamil', 'Hindi', 'French', 'Spanish', 'Chinese', 'Russian', 'Bengali', 'German'];

  const [bionicReading, setBionicReading] = useState(false);
  const [factCheckQuery, setFactCheckQuery] = useState('');
  const [factCheckResult, setFactCheckResult] = useState('');
  const [isFactChecking, setIsFactChecking] = useState(false);
  const [themeColor, setThemeColor] = useState('#00F0FF');
  const THEME_COLORS = ['#00F0FF', '#FF2E93', '#C6FF00', '#8B5CF6', '#FF003C', '#00FF41', '#FFD700', '#FF5E00'];
  const [showSettings, setShowSettings] = useState(false);

  // --- THE 10 EXTRAORDINARY AI FEATURES STATE ---
  const [activeFeature, setActiveFeature] = useState<{id: string, title: string, content: string} | null>(null);
  const [isFeatureLoading, setIsFeatureLoading] = useState<string | null>(null);
  const [podcastLoading, setPodcastLoading] = useState(false);

  const loadNews = async (cat: Category, query?: string) => {
    setLoading(true);
    let fetchCat = cat.toString();
    
    if (cat === 'Local' && !query) {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          const cityName = await getCityName(pos.coords.latitude, pos.coords.longitude);
          const locQuery = `${cityName} news`;
          const data = await fetchLiveNews(fetchCat, locQuery);
          setArticles(data);
          setLoading(false);
        }, async () => {
          const data = await fetchLiveNews('Local', 'Local News India');
          setArticles(data);
          setLoading(false);
        });
        return;
      }
    }

    const data = await fetchLiveNews(fetchCat, query);
    setArticles(data);
    if (onArticlesUpdate) onArticlesUpdate(data);
    setLoading(false);
  };

  useEffect(() => {
    if (view === 'saved' || view === 'factcheck') return;
    loadNews(category);
  }, [category, view]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    setIsSearching(false);
    loadNews(category, searchQuery);
  };

  const displayArticles = view === 'saved' ? saved : articles;

  const toggleSave = (article: LiveArticle) => {
    let newSaved;
    if (saved.find(a => a.id === article.id)) {
      newSaved = saved.filter(a => a.id !== article.id);
    } else {
      newSaved = [...saved, article];
    }
    setSaved(newSaved);
    window.localStorage.setItem('saved_articles', JSON.stringify(newSaved));
  };

  const speak = (id: string, text: string) => {
    if (playingId === id) {
      window.speechSynthesis.cancel();
      setPlayingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setPlayingId(null);
    window.speechSynthesis.speak(utterance);
    setPlayingId(id);
  };

  const generatePodcast = async () => {
    if (articles.length === 0) return;
    setPodcastLoading(true);
    try {
      const top3 = articles.slice(0, 3).map(a => a.title).join(". ");
      const prompt = `You are a hype Gen-Z radio podcast host. Write a 3 sentence flash briefing summarizing these 3 news headlines as if you are speaking live on air. Make it punchy and exciting: ${top3}`;
      const script = await askGemini(prompt);
      speak('podcast', script);
    } catch (e) {
      console.error(e);
    }
    setPodcastLoading(false);
  };

  const handleTranslate = async (id: string, text: string, targetLang: string) => {
    if (translations[id]) return; 
    setTranslating(id);
    setShowLangMenu(null);
    try {
      const trans = await translateWithGemini(text, targetLang);
      setTranslations(prev => ({ ...prev, [id]: trans }));
    } catch (e) {
      alert("Translation failed. Try again.");
    }
    setTranslating(null);
  };

  const loadFullStory = async (article: LiveArticle) => {
    setFullStoryId(article.id);
    setFullStoryContent(article.content || article.summary);
    
    if (article.link !== '#') {
      setIsFullStoryLoading(true);
      
      try {
        // Create a 5-second timeout promise for the scraper
        const timeoutPromise = new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error("Timeout")), 5000)
        );
        
        // Race the scraper against the timeout
        const scraped = await Promise.race([
          scrapeFullArticle(article.link),
          timeoutPromise
        ]).catch(() => "Timeout");

        if (scraped && scraped.length > 200 && !scraped.includes("protected") && scraped !== "Timeout") {
          setFullStoryContent(scraped);
          setIsFullStoryLoading(false);
          return;
        }
      } catch (e) {
        console.warn("Scraping failed or timed out.");
      }

      // Scraper failed: Fallback to AI expansion of the summary
      const existingContent = article.content || article.summary || '';
      const cleanContent = existingContent.replace(/<[^>]*>?/gm, '').trim();
      
      const originalLink = article.link !== '#' 
        ? `<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.1);">
             <a href="${article.link}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 8px; background: #00F0FF; color: black; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none; box-shadow: 0 4px 14px rgba(0,240,255,0.25);">
               Read the original story on ${article.source} 
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
             </a>
           </div>`
        : '';

      try {
        const prompt = `You are a professional journalist. The following is a headline and brief summary of a real, current news event. The full article couldn't be scraped.
        
Headline: ${article.title}
Source: ${article.source}
Summary: ${cleanContent}

TASK: Expand this into a comprehensive, well-written full news article (about 3-4 paragraphs). 
CRITICAL RULES:
1. You are operating in the year 2026. DO NOT mention that your training data cuts off in 2023 or 2024.
2. Base your expansion STRICTLY on the provided summary and headline. Do NOT hallucinate names, dates, or events that are not implied by the summary.
3. Format the response in raw HTML paragraphs (<p> tags). Do not use markdown backticks.
4. Do not include a title (it's already displayed).
5. Write in a neutral, journalistic tone.`;
        
        const expandedArticle = await askGemini(prompt);
        // Clean up any markdown code blocks the AI might still add
        const cleanHtml = expandedArticle.replace(/```html|```/g, '').trim();
        
        setFullStoryContent(
          cleanHtml +
          `<p style="margin-top:16px; font-size: 0.85em; color: #888; border-left: 2px solid #888; padding-left: 12px;"><em>Note: This article was expanded by AI from the original source summary because the publisher blocked full extraction.</em></p>` +
          originalLink
        );
      } catch (err) {
        // Ultimate fallback if AI also fails
        setFullStoryContent(
          `<p style="font-size:1.15em;line-height:1.8;color:rgba(255,255,255,0.9);">${cleanContent}</p>` +
          originalLink
        );
      }
      
      setIsFullStoryLoading(false);
    }
  };

  const runFactCheck = async () => {
    if (!factCheckQuery) return;
    setIsFactChecking(true);
    setFactCheckResult(''); // Clear previous result if any
    
    try {
      // 1. Extract keywords from claim for better Google News RSS matches
      const stopWords = ['is', 'it', 'true', 'that', 'did', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'what', 'why', 'when', 'how', 'who', 'does', 'do', 'are'];
      const keywords = factCheckQuery
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(' ')
        .filter(w => !stopWords.includes(w) && w.length > 2)
        .slice(0, 5) // max 5 keywords for RSS search
        .join(' ');
      
      const searchTerms = keywords.length > 0 ? keywords : factCheckQuery;
      
      // 2. Search Google News for real-time context
      const realTimeArticles = await fetchLiveNews('Search', searchTerms);
      
      // 3. Combine search results with the articles currently on the user's screen
      const combinedContext = [...realTimeArticles, ...articles.slice(0, 15)];
      const uniqueContext = combinedContext.filter((v,i,a)=>a.findIndex(v2=>(v2.title===v.title))===i);

      let context = '';
      if (uniqueContext.length > 0) {
        context = "RECENT NEWS & FEED ARTICLES RELATED TO THIS CLAIM:\n" + 
                  uniqueContext.slice(0, 8).map(a => `Source: ${a.source}\nHeadline: ${a.title}\nSummary: ${a.summary}`).join('\n\n');
      } else {
        context = "No recent articles found. Rely on your base knowledge.";
      }

      // 4. Pass the enhanced real-time context to the fact-checker
      const result = await factCheckWithGemini(factCheckQuery, context);
      setFactCheckResult(result);
    } catch (e) {
      setFactCheckResult("Error: AI Servers overloaded.");
    }
    setIsFactChecking(false);
  };

  const triggerAIFeature = async (article: LiveArticle, featureType: string) => {
    setIsFeatureLoading(article.id + featureType);
    let prompt = "";
    let title = "";
    
    const htmlInstruction = "CRITICAL: You are operating in the year 2026. Do NOT mention that your training data cuts off in 2023 or 2024. Format the response strictly in clean HTML <p> tags. Use <b> for bold text and <ul><li> for lists if needed. Do NOT use markdown.";

    if (featureType === 'ELI5') {
      title = "Explain Like I'm 5";
      prompt = `Explain this news headline and summary as if you are talking to a 5 year old. Keep it simple and fun.\nHeadline: ${article.title}\nSummary: ${article.summary}\n\n${htmlInstruction}`;
    } else if (featureType === 'Debate') {
      title = "Left vs Right Debate";
      prompt = `Analyze this news and provide two distinct perspectives: One from a strongly progressive/liberal viewpoint, and one from a strongly conservative viewpoint. Format nicely.\nHeadline: ${article.title}\n\n${htmlInstruction}`;
    } else if (featureType === 'Impact') {
      title = "Wallet & Life Impact";
      prompt = `How does this specific news directly affect a regular citizen's wallet, daily life, or future? Give practical, direct advice.\nHeadline: ${article.title}\n\n${htmlInstruction}`;
    } else if (featureType === 'Meme') {
      title = "Gen-Z Meme-ify";
      prompt = `Rewrite this news headline and summary completely in heavy Gen-Z brainrot slang (skibidi, rizz, cap, etc) so it sounds like a viral TikTok.\nHeadline: ${article.title}\nSummary: ${article.summary}\n\n${htmlInstruction}`;
    }

    try {
      let result = await askGemini(prompt);
      result = result.replace(/```html/gi, '').replace(/```/g, '').trim();
      setActiveFeature({ id: article.id, title, content: result });
    } catch (e) {
      alert("AI overloaded. Try again.");
    }
    setIsFeatureLoading(null);
  };

  const renderText = (text: string) => {
    if (!bionicReading) return text;
    return text.split(' ').map((word, i) => {
      const splitPoint = Math.ceil(word.length / 2);
      return (
        <span key={i} className="mr-1">
          <b>{word.slice(0, splitPoint)}</b>{word.slice(splitPoint)}
        </span>
      );
    });
  };

  if (view === 'factcheck') {
    return (
      <div className="min-h-screen bg-[#090A0F] p-8 text-white">
        <div className="max-w-2xl mx-auto space-y-8 mt-12">
          <div className="text-center space-y-4">
            <ShieldAlert size={64} className="mx-auto text-[#FF2E93] animate-pulse" />
            <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-[#FF2E93] to-[#00F0FF]">The Truth Engine</h1>
            <p className="text-gray-400">Paste any WhatsApp forward or news claim.</p>
          </div>
          <textarea 
            value={factCheckQuery}
            onChange={e => setFactCheckQuery(e.target.value)}
            className="w-full bg-[#161b22] border-2 border-white/10 rounded-2xl p-4 h-32 focus:border-[#00F0FF] outline-none font-mono"
            placeholder="Paste news claim here..."
          />
          <button onClick={runFactCheck} disabled={isFactChecking} className="w-full py-4 rounded-xl bg-gradient-to-r from-[#00F0FF] to-[#8B5CF6] font-black text-xl hover:opacity-90 transition-opacity flex justify-center items-center gap-2">
            {isFactChecking ? <Loader2 className="animate-spin" /> : <Search />} Verify Claim
          </button>
          {factCheckResult && (
            <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="bg-[#161b22] border border-white/10 p-6 rounded-2xl">
              <h3 className="font-bold text-[#00F0FF] mb-2 uppercase tracking-widest">AI Verdict</h3>
              <div className="font-mono leading-relaxed space-y-3" dangerouslySetInnerHTML={{ __html: factCheckResult }}></div>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'inshorts') {
    return (
      <div className="fixed inset-0 z-40 bg-black snap-y snap-mandatory overflow-y-auto no-scrollbar" style={{ touchAction: 'pan-y' }}>
        <div className="fixed top-4 left-4 z-50 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-bold border border-white/20">
          SNAP SHORTS
        </div>
        {loading && <div className="h-full flex justify-center items-center"><Loader2 className="animate-spin text-white" size={48} /></div>}
        
        {displayArticles.map((article, index) => (
          <div key={article.id} className="h-[100dvh] w-full snap-start relative flex flex-col justify-end pb-24 gpu-accelerated auto-contain">
            <img src={article.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#090A0F] via-[#090A0F]/90 to-transparent h-[70%] top-auto"></div>
            
            <div className="relative z-10 p-5 md:p-8 text-white space-y-4 max-w-2xl mx-auto w-full mb-2">
              
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full animate-pulse shadow-[0_0_10px_currentColor]" style={{ backgroundColor: themeColor, color: themeColor }}></span>
                <span className="inline-block px-3 py-1 text-[10px] md:text-xs font-black uppercase rounded-lg border border-white/20 backdrop-blur-md bg-white/5" style={{ color: themeColor }}>
                  {article.source || "Breaking News"}
                </span>
                <span className="text-[10px] font-bold text-white/50 ml-auto tracking-widest uppercase flex items-center gap-1">
                  Swipe <span className="animate-bounce">↑</span>
                </span>
              </div>

              <h2 className="text-[26px] md:text-4xl font-black leading-[1.1] tracking-tight drop-shadow-2xl">
                {article.title}
              </h2>
              
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: themeColor }}></div>
                <p className="text-[15px] md:text-lg text-gray-200 leading-relaxed line-clamp-5">
                  {translations[article.id] || article.summary}
                </p>
              </div>
              
              <div className="flex items-center gap-2 md:gap-3 pt-2">
                <button 
                  onClick={() => speak(article.id, article.summary)} 
                  className="flex-1 bg-white/10 backdrop-blur-md border border-white/10 py-3.5 rounded-xl hover:bg-white/20 transition-all flex flex-col md:flex-row justify-center items-center gap-1 text-[11px] md:text-sm font-bold uppercase tracking-wider"
                >
                  {playingId === article.id ? <Pause size={18} style={{ color: themeColor }} /> : <Play size={18} />} 
                  <span className={playingId === article.id ? "" : "text-white/70"}>Listen</span>
                </button>
                
                <button 
                  onClick={() => triggerAIFeature(article, 'Meme')} 
                  className="flex-1 bg-white/10 backdrop-blur-md border border-white/10 py-3.5 rounded-xl hover:bg-white/20 transition-all flex flex-col md:flex-row justify-center items-center gap-1 text-[11px] md:text-sm font-bold uppercase tracking-wider"
                >
                  {isFeatureLoading === article.id + 'Meme' ? <Loader2 size={18} className="animate-spin" style={{ color: themeColor }} /> : <Sparkles size={18} style={{ color: themeColor }} />} 
                  <span className="text-white/70 hidden sm:inline">Meme</span>
                </button>

                <div className="flex-1">
                  <ShareMenu 
                    article={article} 
                    themeColor={themeColor} 
                    customTrigger={
                      <button className="w-full bg-white/10 backdrop-blur-md border border-white/10 py-3.5 rounded-xl hover:bg-white/20 transition-all flex flex-col md:flex-row justify-center items-center gap-1 text-[11px] md:text-sm font-bold uppercase tracking-wider">
                        <Share2 size={18} style={{ color: themeColor }} />
                        <span className="text-white/70 hidden sm:inline">Share</span>
                      </button>
                    }
                  />
                </div>
                
                <button 
                  onClick={() => loadFullStory(article)} 
                  className="flex-[1.5] text-black font-black py-3.5 rounded-xl flex justify-center items-center gap-2 text-sm md:text-base uppercase tracking-wider shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:scale-[1.02] transition-transform"
                  style={{ backgroundColor: themeColor }}
                >
                  Read Full <Maximize2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {/* Full Story & AI Feature Modal for Shorts */}
        <AnimatePresence>
          {fullStoryId && (
            <motion.div initial={{opacity:0, y:'100%'}} animate={{opacity:1, y:0}} exit={{opacity:0, y:'100%'}} className="fixed inset-0 z-[100] bg-[#090A0F] overflow-y-auto no-scrollbar">
              <button onClick={() => setFullStoryId(null)} className="fixed top-4 right-4 z-50 bg-white/10 p-2 rounded-full text-white"><X /></button>
                <div className="max-w-3xl mx-auto p-6 md:p-12 text-white space-y-6 mt-12 pb-24">
                  <h1 className="text-4xl font-black">{displayArticles.find(a => a.id === fullStoryId)?.title}</h1>
                  <img src={displayArticles.find(a => a.id === fullStoryId)?.image} className="w-full h-64 object-cover rounded-xl" alt=""/>
                  {isFullStoryLoading && <div className="flex gap-2 items-center text-[#00F0FF]"><Loader2 className="animate-spin"/> Extracting full article from source...</div>}
                  <div className="prose prose-invert prose-lg max-w-none text-gray-300 font-serif leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: fullStoryContent }}></div>
                </div>
            </motion.div>
          )}
          {activeFeature && (
            <motion.div initial={{opacity:0, scale:0.9}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.9}} className="fixed inset-4 z-[110] bg-[#161b22] border-2 border-[#00F0FF] rounded-3xl p-6 overflow-y-auto shadow-[0_0_50px_rgba(0,240,255,0.3)]">
              <button onClick={() => setActiveFeature(null)} className="absolute top-4 right-4 bg-white/10 p-2 rounded-full text-white"><X /></button>
              <h2 className="text-2xl font-black text-[#00F0FF] mb-6 border-b border-white/10 pb-4" style={{ color: themeColor }}>{activeFeature.title}</h2>
              <div 
                className="text-white text-lg font-mono leading-relaxed space-y-4"
                dangerouslySetInnerHTML={{ __html: activeFeature.content }} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Normal Feed View
  return (
    <div className="min-h-screen bg-[#090A0F] text-gray-100 font-sans selection:bg-[#00F0FF] selection:text-black relative overflow-x-hidden">
      
      {/* Ambient Glowing Background Orbs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-gradient-to-br from-[#FF2E93]/20 to-transparent blur-[120px] rounded-full mix-blend-screen opacity-70 animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-tl from-[#00F0FF]/20 to-transparent blur-[120px] rounded-full mix-blend-screen opacity-70 animate-pulse" style={{ animationDuration: '10s' }}></div>
      </div>

      {view !== 'saved' && (
        <div className="sticky top-0 z-40 bg-[#090A0F]/90 backdrop-blur-xl border-b border-white/10 p-4 shadow-lg shadow-black/50 space-y-4">
          <div className="flex justify-between items-center max-w-4xl mx-auto">
            <button onClick={generatePodcast} className="px-3 md:px-4 py-1.5 rounded-full text-xs md:text-sm font-black tracking-wide bg-[#FF2E93] text-white flex items-center gap-1 md:gap-2 hover:scale-105 transition-transform shadow-[0_0_15px_#FF2E93]">
              {podcastLoading ? <Loader2 size={16} className="animate-spin"/> : playingId === 'podcast' ? <Pause size={16}/> : <Mic size={16}/>} TL;DR Audio
            </button>
            <div className="flex gap-1 md:gap-2">
              <button onClick={() => setBionicReading(!bionicReading)} className={`p-2 rounded-full ${bionicReading ? 'text-[#C6FF00]' : 'text-gray-400'}`} title="Bionic Reading"><Eye size={18} /></button>
              <button onClick={() => loadNews(category)} className="p-2 rounded-full text-gray-400"><RefreshCw size={18} /></button>
              <button onClick={() => setIsSearching(!isSearching)} className="p-2 rounded-full text-[#00F0FF]"><Search size={18} /></button>
              <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-full text-gray-400 hover:text-white"><Settings size={18} /></button>
            </div>
          </div>
          
          <div className="flex gap-3 overflow-x-auto no-scrollbar items-center max-w-4xl mx-auto">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)} className={`px-4 py-1.5 rounded-full text-sm font-bold tracking-wide whitespace-nowrap transition-all flex items-center gap-1 ${category === cat ? 'bg-gradient-to-r from-[#00F0FF] to-[#8B5CF6] text-white' : 'bg-white/5 text-gray-400'}`}>
                {cat === 'Blind Spot' && <Eye size={14}/>} {cat}
              </button>
            ))}
          </div>
          <AnimatePresence>
            {showSettings && (
              <motion.div initial={{height:0, opacity:0}} animate={{height:'auto', opacity:1}} exit={{height:0, opacity:0}} className="max-w-4xl mx-auto pt-4 border-t border-white/10 mt-4">
                <div className="flex items-center gap-4 flex-wrap justify-between">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Theme:</span>
                    <div className="flex gap-2">
                      {THEME_COLORS.map(color => (
                        <button 
                          key={color} 
                          onClick={() => setThemeColor(color)}
                          className={`w-6 h-6 rounded-full border-2 ${themeColor === color ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'} transition-all`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setMode?.('saved')} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-sm font-bold w-full md:w-auto justify-center mt-2 md:mt-0" style={{ color: themeColor }}>
                    <Bookmark size={16} /> View Saved Articles
                  </button>
                </div>
              </motion.div>
            )}
            {isSearching && (
              <motion.form initial={{height:0, opacity:0}} animate={{height:'auto', opacity:1}} exit={{height:0, opacity:0}} onSubmit={handleSearch} className="max-w-4xl mx-auto pt-4">
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search via AI Synthesis..." className="w-full bg-[#161b22] border border-[#00F0FF] rounded-xl px-4 py-3 outline-none text-white shadow-[0_0_15px_#00F0FF]" />
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      )}

      <main className="p-4 md:p-8 max-w-4xl mx-auto pb-32">
        {view === 'saved' && <h2 className="text-3xl font-black mb-6 text-white tracking-tight">Offline Vault 🔒</h2>}
        
        {loading ? (
          <div className="flex flex-col justify-center items-center h-64 gap-4">
             <Loader2 size={48} className="animate-spin text-[#00F0FF]" />
             <p className="font-mono text-sm text-gray-400">Synthesizing World Data...</p>
          </div>
        ) : (
          <div className="space-y-12">
            {displayArticles.map((article, index) => {
              const isSaved = !!saved.find(a => a.id === article.id);
              
              return (
                <motion.article 
                  key={article.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.1, 1) }}
                  className="bg-[#161b22] rounded-3xl border border-white/5 overflow-hidden shadow-2xl relative hover:border-white/20 transition-all group gpu-accelerated auto-contain"
                >
                  <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_0%,_#00F0FF_0%,_transparent_70%)] pointer-events-none"></div>

                  <div className="relative h-72 w-full cursor-pointer" onClick={() => loadFullStory(article)}>
                    <img src={article.image} alt="News" className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#161b22] via-[#161b22]/20 to-transparent"></div>
                    <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md text-white text-xs font-mono px-3 py-1 rounded-full border border-white/10">
                      {article.source}
                    </div>
                  </div>

                  <div className="p-4 md:p-8 relative z-10 -mt-16">
                    <h2 onClick={() => loadFullStory(article)} className="text-xl md:text-3xl font-black leading-tight text-white mb-3 md:mb-4 drop-shadow-md cursor-pointer hover:text-[#00F0FF] transition-colors">
                      {article.title}
                    </h2>
                    
                    <div className="text-gray-300 font-medium text-base md:text-lg leading-relaxed mb-4 md:mb-6">
                      {renderText(translations[article.id] || article.summary)}
                    </div>

                    {/* AI FEATURE DOCK */}
                    <div className="flex flex-wrap gap-2 mb-6 md:mb-8 bg-black/30 p-2 md:p-3 rounded-xl md:rounded-2xl border border-white/5">
                      <span className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest w-full mb-1">AI Tools</span>
                      <button onClick={() => triggerAIFeature(article, 'ELI5')} className="flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-3 md:py-1.5 rounded-md md:rounded-lg text-[10px] md:text-xs font-bold bg-[#8B5CF6]/20 text-[#8B5CF6] hover:bg-[#8B5CF6]/40 transition">
                        {isFeatureLoading === article.id + 'ELI5' ? <Loader2 size={12} className="animate-spin"/> : <Brain size={12} className="md:w-3.5 md:h-3.5"/>} ELI5
                      </button>
                      <button onClick={() => triggerAIFeature(article, 'Debate')} className="flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-3 md:py-1.5 rounded-md md:rounded-lg text-[10px] md:text-xs font-bold bg-[#00F0FF]/20 text-[#00F0FF] hover:bg-[#00F0FF]/40 transition">
                        {isFeatureLoading === article.id + 'Debate' ? <Loader2 size={12} className="animate-spin"/> : <Scale size={12} className="md:w-3.5 md:h-3.5"/>} Debate
                      </button>
                      <button onClick={() => triggerAIFeature(article, 'Impact')} className="flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-3 md:py-1.5 rounded-md md:rounded-lg text-[10px] md:text-xs font-bold bg-[#C6FF00]/20 text-[#C6FF00] hover:bg-[#C6FF00]/40 transition">
                        {isFeatureLoading === article.id + 'Impact' ? <Loader2 size={12} className="animate-spin"/> : <Wallet size={12} className="md:w-3.5 md:h-3.5"/>} Impact
                      </button>
                      <button onClick={() => triggerAIFeature(article, 'Meme')} className="flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-3 md:py-1.5 rounded-md md:rounded-lg text-[10px] md:text-xs font-bold bg-[#FF2E93]/20 text-[#FF2E93] hover:bg-[#FF2E93]/40 transition">
                        {isFeatureLoading === article.id + 'Meme' ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12} className="md:w-3.5 md:h-3.5"/>} Meme-ify
                      </button>
                    </div>

                    {/* Action buttons — clean mobile-first layout */}
                    <div className="space-y-2">
                      {/* Full Story — full width prominent CTA */}
                      <button onClick={() => loadFullStory(article)} className="w-full flex justify-center items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm text-black hover:opacity-90 transition-all shadow-lg" style={{ backgroundColor: themeColor }}>
                        <BookOpen size={16} /> Read Full Story
                      </button>

                      {/* Bottom row — 4 even buttons */}
                      <div className="grid grid-cols-4 gap-1.5">
                        <button onClick={() => speak(article.id, article.summary)} className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl font-bold text-[10px] md:text-xs transition-all ${playingId === article.id ? 'text-black' : 'bg-white/5 hover:bg-white/10'}`} style={playingId === article.id ? { backgroundColor: themeColor, boxShadow: `0 0 12px ${themeColor}60` } : {}}>
                          {playingId === article.id ? <Volume2 size={16} className="animate-pulse" /> : <Volume2 size={16} />}
                          Listen
                        </button>

                        <div className="relative">
                          <button onClick={() => setShowLangMenu(showLangMenu === article.id ? null : article.id)} disabled={translating === article.id} className="w-full flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl font-bold text-[10px] md:text-xs bg-white/5 hover:bg-white/10 transition-all disabled:opacity-50">
                            {translating === article.id ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                            Translate
                          </button>
                          {showLangMenu === article.id && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 bg-[#090A0F] border border-white/20 rounded-xl shadow-2xl overflow-hidden z-50">
                              {SUPPORTED_LANGUAGES.map(lang => (
                                <button key={lang} onClick={() => handleTranslate(article.id, article.summary, lang)} className="block w-full text-left px-4 py-2 text-xs font-bold hover:bg-white/10 text-white transition-colors">
                                  {lang}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <ShareMenu article={article} themeColor={themeColor} />

                        <button onClick={() => toggleSave(article)} className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl font-bold text-[10px] md:text-xs transition-all ${isSaved ? 'text-[#FF2E93] bg-[#FF2E93]/20' : 'bg-white/5 hover:bg-white/10 text-gray-400'}`}>
                          <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
                          {isSaved ? 'Saved' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.article>
              )
            })}
          </div>
        )}

        {/* Full Story Modal Overlay */}
        <AnimatePresence>
          {fullStoryId && (
            <motion.div initial={{opacity:0, y:'100%'}} animate={{opacity:1, y:0}} exit={{opacity:0, y:'100%'}} className="fixed inset-0 z-[100] bg-[#090A0F] overflow-y-auto no-scrollbar">
              <div className="fixed top-4 right-4 z-50 flex gap-2">
                {displayArticles.find(a => a.id === fullStoryId) && (
                  <ShareMenu 
                    article={displayArticles.find(a => a.id === fullStoryId)!} 
                    themeColor={themeColor}
                    customTrigger={
                      <button className="bg-white/10 p-3 rounded-full text-white hover:bg-white/20 flex items-center justify-center">
                        <Share2 size={24} />
                      </button>
                    }
                  />
                )}
                <button onClick={() => setFullStoryId(null)} className="bg-white/10 p-3 rounded-full text-white hover:bg-white/20"><X size={24} /></button>
              </div>
                <div className="max-w-4xl mx-auto p-4 md:p-12 text-white pb-32 mt-12">
                  <img src={displayArticles.find(a => a.id === fullStoryId)?.image} className="w-full h-80 md:h-96 object-cover rounded-3xl mb-8 shadow-2xl" alt=""/>
                  <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight">{displayArticles.find(a => a.id === fullStoryId)?.title}</h1>
                  
                  {isFullStoryLoading && <div className="mb-6 flex gap-2 items-center text-[#00F0FF]"><Loader2 className="animate-spin"/> Extracting full article from source...</div>}

                  <div className="prose prose-invert prose-xl max-w-none text-gray-300 font-serif leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: fullStoryContent }}>
                  </div>
                </div>
            </motion.div>
          )}

          {/* AI Feature Result Modal */}
          {activeFeature && (
            <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.95}} className="fixed inset-4 md:inset-x-32 md:inset-y-16 z-[110] bg-[#161b22] border-2 border-[#00F0FF] rounded-3xl p-6 md:p-12 overflow-y-auto shadow-[0_0_100px_rgba(0,240,255,0.2)]">
              <button onClick={() => setActiveFeature(null)} className="absolute top-4 right-4 bg-white/10 p-2 rounded-full text-white hover:bg-white/20"><X /></button>
              <h2 className="text-3xl font-black text-[#00F0FF] mb-8 border-b border-white/10 pb-4" style={{ color: themeColor }}>{activeFeature.title}</h2>
              <div 
                className="text-white text-lg md:text-xl font-mono leading-relaxed space-y-4 text-left" 
                dangerouslySetInnerHTML={{ __html: activeFeature.content }} 
              />
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
