import { useState, useEffect } from 'react';
import CyberMode from './components/CyberMode';
import BroadsheetMode from './components/BroadsheetMode';
import BottomNav from './components/BottomNav';
import AIDrawer from './components/AIDrawer';
import Ticker from './components/Ticker';

import type { LiveArticle } from './utils/liveNews';

function App() {
  const [mode, setMode] = useState<'cyber' | 'broadsheet' | 'inshorts' | 'saved' | 'factcheck'>('cyber');
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [articles, setArticles] = useState<LiveArticle[]>([]);

  useEffect(() => {
    document.documentElement.className = `theme-${mode === 'broadsheet' ? 'broadsheet' : 'cyber'}`;
  }, [mode]);

  return (
    <div className={`pb-24 overflow-x-hidden min-h-screen ${mode === 'broadsheet' ? 'bg-[#F5F2E9]' : 'bg-[#0f111a]'}`}>
      <Ticker />
      
      <div className="transition-opacity duration-500">
        {mode === 'cyber' && <CyberMode view="feed" setMode={setMode} onArticlesUpdate={setArticles} />}
        {mode === 'factcheck' && <CyberMode view="factcheck" setMode={setMode} onArticlesUpdate={setArticles} />}
        {mode === 'inshorts' && <CyberMode view="inshorts" setMode={setMode} onArticlesUpdate={setArticles} />}
        {mode === 'saved' && <CyberMode view="saved" setMode={setMode} onArticlesUpdate={setArticles} />}
        {mode === 'broadsheet' && <BroadsheetMode />}
      </div>

      <BottomNav 
        mode={mode} 
        setMode={setMode} 
        toggleAI={() => setIsAIOpen(true)} 
      />

      <AIDrawer isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} articles={articles} />
    </div>
  );
}

export default App;
