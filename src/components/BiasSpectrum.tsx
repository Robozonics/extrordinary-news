import { mockArticles } from '../data/mockData';

export default function BiasSpectrum({ article = mockArticles[0] }: { article?: typeof mockArticles[0] }) {
  const { biasAndCoverage } = article;
  
  return (
    <div className="w-full border-4 border-black bg-white p-4 shadow-[4px_4px_0_#FF2E93] text-black my-6 transform rotate-1">
      <div className="flex justify-between items-center mb-4 border-b-2 border-black pb-2">
        <h3 className="font-black uppercase tracking-widest text-sm">Factuality Spectrum</h3>
        <span className="bg-[#C6FF00] text-black font-bold px-2 py-1 text-xs border-2 border-black">
          {biasAndCoverage.factuality}
        </span>
      </div>
      
      <div className="space-y-4">
        {/* Left */}
        <div className="flex items-start gap-3">
          <div className="w-12 text-center flex-shrink-0">
             <div className="bg-blue-500 text-white font-bold text-[10px] py-1 border border-black uppercase">Left</div>
          </div>
          <div>
            <div className="text-xs font-mono font-bold text-gray-500">{biasAndCoverage.spectrum.left.outlet}</div>
            <div className="font-bold text-sm leading-tight">{biasAndCoverage.spectrum.left.headline}</div>
          </div>
        </div>
        
        {/* Center */}
        <div className="flex items-start gap-3">
          <div className="w-12 text-center flex-shrink-0">
             <div className="bg-gray-400 text-white font-bold text-[10px] py-1 border border-black uppercase">Center</div>
          </div>
          <div>
            <div className="text-xs font-mono font-bold text-gray-500">{biasAndCoverage.spectrum.center.outlet}</div>
            <div className="font-bold text-sm leading-tight">{biasAndCoverage.spectrum.center.headline}</div>
          </div>
        </div>
        
        {/* Right */}
        <div className="flex items-start gap-3">
          <div className="w-12 text-center flex-shrink-0">
             <div className="bg-red-500 text-white font-bold text-[10px] py-1 border border-black uppercase">Right</div>
          </div>
          <div>
            <div className="text-xs font-mono font-bold text-gray-500">{biasAndCoverage.spectrum.right.outlet}</div>
            <div className="font-bold text-sm leading-tight">{biasAndCoverage.spectrum.right.headline}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
