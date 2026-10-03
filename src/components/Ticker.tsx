import React from 'react';
import { mockArticle } from '../data/mockData';

export default function Ticker() {
  return (
    <div className="bg-red-600 text-white font-mono text-sm py-1 overflow-hidden whitespace-nowrap flex items-center border-b-2 border-black z-50 relative">
      <div className="bg-black text-red-500 font-bold px-3 py-1 uppercase z-10 flex items-center gap-2">
        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
        BREAKING NEWS
      </div>
      <div className="animate-[marquee_20s_linear_infinite] inline-block">
        <span className="mx-4">{mockArticle.title.toUpperCase()}</span>
        <span>•</span>
        <span className="mx-4">GLOBAL MARKETS SURGE ON AI DISCOVERY</span>
        <span>•</span>
        <span className="mx-4">STANFORD LABS CONFIRM QUANTUM STABILITY</span>
        <span>•</span>
        <span className="mx-4">{mockArticle.title.toUpperCase()}</span>
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
