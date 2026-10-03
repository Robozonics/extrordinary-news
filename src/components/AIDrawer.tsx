import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Send, Play, Pause, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { askGemini } from '../utils/gemini';
import type { LiveArticle } from '../utils/liveNews';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  articles: LiveArticle[];
}

export default function AIDrawer({ isOpen, onClose, articles }: Props) {
  const [query, setQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'ai', text: string}[]>([
    { role: 'ai', text: 'Sup chat. I am Summer. Ask me anything about the news feed rn.' }
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!query.trim()) return;
    const userQ = query;
    setMessages(prev => [...prev, { role: 'user', text: userQ }]);
    setQuery('');
    setIsTyping(true);
    
    // Use the actual live articles passed from props to ground the AI
    const context = articles.slice(0, 15).map(a => `Source: ${a.source}\nTitle: ${a.title}\nSummary: ${a.summary}`).join('\n\n');
    
    try {
      const response = await askGemini(userQ, context);
      setMessages(prev => [...prev, { role: 'ai', text: response }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Server is cooked. Try again later.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-[100]" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="fixed bottom-0 left-0 right-0 h-[85vh] bg-[#111520] border-t-8 border-[#FF2E93] z-[101] shadow-[0_-10px_0_#C6FF00] flex flex-col rounded-t-2xl"
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b-4 border-black bg-[#C6FF00] text-black rounded-t-xl">
              <div className="flex items-center gap-2 font-black uppercase text-xl">
                <Sparkles /> Summer AI Copilot
              </div>
              <button onClick={onClose} className="p-1 hover:bg-black hover:text-[#C6FF00] border-2 border-transparent hover:border-black transition-colors rounded-full">
                <X size={24} />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#090A0F]">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 font-mono text-sm border-2 whitespace-pre-wrap ${
                    m.role === 'user' 
                      ? 'bg-[#FF2E93] text-white border-black shadow-[4px_4px_0_#00F0FF]' 
                      : 'bg-[#111520] text-[#C6FF00] border-[#C6FF00] shadow-[4px_4px_0_#FF2E93]'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-[#111520] text-[#C6FF00] border-2 border-[#C6FF00] shadow-[4px_4px_0_#FF2E93] p-3 flex gap-2 items-center">
                    <Loader2 size={16} className="animate-spin" /> <span className="font-mono text-sm font-bold">Synthesizing...</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* AI Audio Controls */}
            <div className="p-3 bg-[#111520] border-t-2 border-dashed border-[#1F2636] flex items-center justify-between text-[#00F0FF]">
              <span className="text-xs font-mono font-bold uppercase tracking-widest flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse"></div> Live Audio Broadcast
              </span>
              <div className="flex gap-2">
                <button className="p-2 border border-[#00F0FF] hover:bg-[#00F0FF] hover:text-black transition-colors"><Play size={16} /></button>
                <button className="p-2 border border-[#00F0FF] hover:bg-[#00F0FF] hover:text-black transition-colors"><Pause size={16} /></button>
              </div>
            </div>

            {/* Input */}
            <div className="p-4 bg-[#090A0F] border-t-4 border-black pb-8">
              <div className="flex gap-2 relative">
                <input 
                  type="text" 
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSend()}
                  placeholder="Ask me anything..." 
                  className="flex-1 bg-black border-4 border-[#00F0FF] text-white p-3 font-mono outline-none focus:border-[#C6FF00] placeholder-gray-600"
                />
                <button 
                  onClick={handleSend}
                  disabled={isTyping}
                  className="bg-[#C6FF00] text-black border-4 border-black p-3 hover:bg-[#FF2E93] hover:text-white transition-colors disabled:opacity-50"
                >
                  <Send size={24} />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
