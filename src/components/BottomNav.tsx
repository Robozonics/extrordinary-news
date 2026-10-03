import { Home, Layers, Sparkles, BookOpen, Bookmark, ShieldAlert } from 'lucide-react';

interface NavProps {
  mode: 'cyber' | 'broadsheet' | 'inshorts' | 'saved' | 'factcheck';
  setMode: (m: 'cyber' | 'broadsheet' | 'inshorts' | 'saved' | 'factcheck') => void;
  toggleAI: () => void;
}

export default function BottomNav({ mode, setMode, toggleAI }: NavProps) {
  const isPrint = mode === 'broadsheet';
  
  const navClass = isPrint 
    ? "fixed bottom-0 left-0 right-0 z-50 bg-paper-bg border-t-2 border-paper-ink p-2 sm:p-3 flex justify-between items-center text-paper-ink shadow-[0_-4px_10px_rgba(0,0,0,0.1)]"
    : "fixed bottom-4 left-2 right-2 sm:bottom-6 sm:left-6 sm:right-6 z-50 bg-[#161b22]/80 backdrop-blur-2xl border border-white/20 rounded-full px-2 sm:px-4 py-2 flex justify-between items-center shadow-[0_20px_50px_rgba(0,0,0,0.8)]";

  const getBtnClass = (target: string) => {
    if (isPrint) return `flex flex-col items-center gap-1 p-1 sm:p-2 transition-colors font-serif text-[10px] sm:text-xs uppercase w-full ${mode === target ? 'bg-paper-ink text-paper-bg' : 'hover:bg-paper-ink hover:text-paper-bg'}`;
    return `flex flex-col items-center gap-1 p-1 sm:p-2 transition-all rounded-full w-full max-w-[4rem] sm:max-w-[5rem] ${mode === target ? 'text-white bg-white/10 shadow-[inset_0_0_10px_rgba(255,255,255,0.1)]' : 'text-gray-400 hover:text-white'}`;
  };

  return (
    <nav className={navClass}>
      <div className="flex flex-1 justify-around items-center">
        <button onClick={() => setMode('cyber')} className={getBtnClass('cyber')}>
          <Home size={isPrint ? 18 : 20} className="sm:w-[22px] sm:h-[22px]" />
          {!isPrint && <span className="text-[9px] sm:text-[10px] font-bold font-mono">Feed</span>}
        </button>
        <button onClick={() => setMode('inshorts')} className={getBtnClass('inshorts')}>
          <Layers size={isPrint ? 18 : 20} className="sm:w-[22px] sm:h-[22px]" />
          {!isPrint && <span className="text-[9px] sm:text-[10px] font-bold font-mono">Shorts</span>}
        </button>
      </div>
      
      {/* Center AI Action */}
      <div className="flex shrink-0 justify-center items-center px-1 sm:px-2">
        <button 
          onClick={toggleAI}
          className={isPrint 
            ? "transform -translate-y-3 sm:-translate-y-4 bg-paper-ink text-paper-bg p-3 sm:p-4 border-2 border-paper-bg rounded-full shadow-lg hover:scale-110 transition-transform flex items-center justify-center shrink-0"
            : "transform -translate-y-5 sm:-translate-y-6 bg-gradient-to-r from-[#FF2E93] to-[#8B5CF6] text-white p-3 sm:p-4 rounded-full shadow-[0_0_20px_rgba(255,46,147,0.5)] hover:scale-110 transition-transform flex items-center justify-center border-2 border-white/20 shrink-0"
          }
        >
          <Sparkles size={24} className={`sm:w-[28px] sm:h-[28px] ${!isPrint ? "animate-pulse" : ""}`} />
        </button>
      </div>

      <div className="flex flex-1 justify-around items-center">
        <button onClick={() => setMode('factcheck')} className={getBtnClass('factcheck')}>
          <ShieldAlert size={isPrint ? 18 : 20} className="sm:w-[22px] sm:h-[22px]" />
          {!isPrint && <span className="text-[9px] sm:text-[10px] font-bold font-mono">Verify</span>}
        </button>
        <button onClick={() => setMode('broadsheet')} className={getBtnClass('broadsheet')}>
          <BookOpen size={isPrint ? 18 : 20} className="sm:w-[22px] sm:h-[22px]" />
          {!isPrint && <span className="text-[9px] sm:text-[10px] font-bold font-mono">Print</span>}
        </button>
      </div>
    </nav>
  );
}
