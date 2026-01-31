import React from 'react';

// URLの例: /bind?name=うるく&rarity=CHAOS&text=アビリティ禁止
export function BindDetailView() {
  // URLから情報を取得
  const params = new URLSearchParams(window.location.search);
  const name = params.get('name') || 'Unknown';
  const rarity = params.get('rarity') || 'Common';
  const text = params.get('text') || '';

  // 以前のレアリティバッジのデザインを流用
  const rarityBadge = (r: string) => {
    const base = 'inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-black uppercase tracking-[0.2em] mb-4';
    switch (r) {
      case 'CHAOS': return `${base} border-[#FF4655]/70 bg-[#FF4655]/20 text-[#FFE9EC]`;
      case 'Epic': return `${base} border-purple-400/45 bg-purple-400/15 text-purple-100`;
      case 'Exotic': return `${base} border-green-400/45 bg-green-400/15 text-green-100`;
      default: return `${base} border-white/20 bg-white/5 text-white/80`;
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1923] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#1A2531] border border-white/10 rounded-xl p-8 shadow-2xl">
        <div className="text-white/50 text-sm uppercase tracking-widest border-b border-white/10 pb-2 mb-6 font-bold">
          {name}'S MISSION BIND
        </div>
        
        <div className="flex flex-col items-center text-center">
          <span className={rarityBadge(rarity)}>{rarity}</span>
          <h2 className="text-white text-2xl md:text-3xl font-bold leading-relaxed break-words whitespace-pre-wrap italic">
            {text}
          </h2>
        </div>

        <div className="mt-8 text-center">
          <button 
            onClick={() => window.close()} 
            className="text-white/30 hover:text-white text-xs underline"
          >
            CLOSE WINDOW
          </button>
        </div>
      </div>
    </div>
  );
}