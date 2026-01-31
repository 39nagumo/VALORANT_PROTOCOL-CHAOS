import { useRef, useState, useEffect } from 'react';
import { GachaResult } from '../logic/gacha';
import { AgentCard } from './AgentCard';

// @ts-ignore
import html2canvas from 'html2canvas';

interface Props {
  result: GachaResult;
  onRetry: (lockedIndices: number[]) => void;
  onUpdateResult: (newResult: GachaResult) => void;
  onViewBinds: () => void;
  onViewMap: () => void;
  onNavigateToSubmit: () => void; // ✅ 追加
  shouldAnimate: boolean;
}

export function GachaResultView({ 
  result: initialResult, 
  onRetry, 
  onUpdateResult, 
  onViewBinds, 
  onViewMap, 
  onNavigateToSubmit, // ✅ 追加
  shouldAnimate 
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [side, setSide] = useState<'ATTACKER' | 'DEFENDER'>('ATTACKER');
  const [visibleCount, setVisibleCount] = useState(shouldAnimate ? 0 : 5);
  const [lockedIndices, setLockedIndices] = useState<number[]>([]);

  useEffect(() => {
    if (shouldAnimate) {
      setVisibleCount(0);
    } else {
      setVisibleCount(5);
    }
  }, [initialResult, shouldAnimate]);

  useEffect(() => {
    if (visibleCount < initialResult.players.length) {
      const timer = setTimeout(() => {
        setVisibleCount(prev => prev + 1);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [visibleCount, initialResult.players.length]);

  const toggleLock = (index: number) => {
    setLockedIndices(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleRerollAgent = (playerIndex: number) => {
    const pool = initialResult.allAgentsPool;
    if (!pool) return;
    const targetPlayer = initialResult.players[playerIndex];
    const otherAgentNames = initialResult.players
      .filter((_, idx) => idx !== playerIndex)
      .map(p => p.agent.name);

    const candidates = pool.filter(a => 
      a.role === targetPlayer.agent.role && 
      a.name !== targetPlayer.agent.name && 
      !otherAgentNames.includes(a.name)
    );
    if (candidates.length === 0) return;

    const newAgent = candidates[Math.floor(Math.random() * candidates.length)];
    const newPlayers = [...initialResult.players];
    newPlayers[playerIndex] = { ...targetPlayer, agent: newAgent };
    onUpdateResult({ ...initialResult, players: newPlayers });
  };

  const handleRerollBind = (bindIndex: number) => {
    const pool = initialResult.allBindsPool;
    if (!pool) return;
    const targetBind = initialResult.binds[bindIndex];
    const otherBindTexts = initialResult.binds
      .filter((_, idx) => idx !== bindIndex)
      .map(b => b.text);

    const candidates = pool.filter(b => 
      b.rarity === targetBind.rarity && 
      b.text !== targetBind.text && 
      !otherBindTexts.includes(b.text)
    );
    if (candidates.length === 0) return;

    const newBind = candidates[Math.floor(Math.random() * candidates.length)];
    const newBinds = [...initialResult.binds];
    newBinds[bindIndex] = newBind;
    onUpdateResult({ ...initialResult, binds: newBinds });
  };

  const handleSaveImage = async () => {
    if (!containerRef.current) return;
    setSaving(true);
    
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    window.scrollTo(0, 0);

    try {
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#0F1923',
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
        onclone: (clonedDoc) => {
          const animatedElements = clonedDoc.querySelectorAll('.animate-card-in');
          animatedElements.forEach((el) => {
            const element = el as HTMLElement;
            element.style.opacity = '1';
            element.style.transform = 'none';
            element.style.animation = 'none';
          });
        }
      });

      const link = document.createElement('a');
      link.download = `valorant-chaos-gacha-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (e) {
      console.error('Failed to capture', e);
    } finally {
      window.scrollTo(scrollX, scrollY);
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 items-center w-full max-w-[1400px] mx-auto">
      <div
        ref={containerRef}
        className="bg-[#0F1923] p-4 md:p-5 rounded border border-white/10 relative overflow-hidden"
        style={{ minWidth: '1100px' }} 
      >
        <div className="absolute top-4 left-4 z-20 flex bg-black/40 p-1 rounded border border-white/10">
          <button
            onClick={() => setSide('ATTACKER')}
            className={`px-3 py-1 text-[10px] font-black tracking-tighter transition-all ${
              side === 'ATTACKER' ? 'bg-[#FF4655] text-white' : 'text-white/40 hover:text-white'
            }`}
          >
            ATTACKER
          </button>
          <button
            onClick={() => setSide('DEFENDER')}
            className={`px-3 py-1 text-[10px] font-black tracking-tighter transition-all ${
              side === 'DEFENDER' ? 'bg-[#46CBFF] text-white' : 'text-white/40 hover:text-white'
            }`}
          >
            DEFENDER
          </button>
        </div>

        <div className="absolute top-1 right-3 text-[10px] text-gray-500 font-mono">
          SEED: {initialResult.seed}
        </div>

        <div className="mb-4 text-center">
          <h2 className={`text-xl md:text-3xl font-black uppercase italic leading-none transition-colors ${side === 'ATTACKER' ? 'text-[#FF4655]' : 'text-[#46CBFF]'}`}>
            MISSION PROTOCOL / {side === 'ATTACKER' ? 'ATTACKER' : 'DEFENDER'}
          </h2>
          <p className="text-[10px] md:text-xs text-gray-300/60 tracking-[0.2em] uppercase mt-2 leading-relaxed">
            5 Agents + Constraints (Per Player)
          </p>
        </div>

        <section className="w-full">
          <div className="grid grid-cols-5 gap-2">
            {initialResult.players.map((p, idx) => {
              const bind = initialResult.binds[idx];
              return (
                <div 
                  key={`${p.id}-${p.agent.name}-${bind?.text}`}
                  className={`transition-all duration-700 ${idx < visibleCount ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                >
                  <AgentCard
                    index={idx}
                    player={p}
                    bindText={bind?.text}
                    bindRarity={bind?.rarity}
                    onRerollAgent={() => handleRerollAgent(idx)}
                    onRerollBind={() => handleRerollBind(idx)}
                    isLocked={lockedIndices.includes(idx)}
                    onToggleLock={() => toggleLock(idx)}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-4 text-center text-[9px] font-mono uppercase tracking-widest leading-relaxed">
          <span className="text-gray-500">VALORANT CUSTOM</span>{' '}
          <span className={`transition-colors ${side === 'ATTACKER' ? 'text-[#FF4655]/40' : 'text-[#46CBFF]/40'}`}>CHAOS GACHA</span>
        </div>
      </div>

      <div className={`flex flex-col items-center gap-2 w-full mt-2 transition-opacity duration-1000 ${visibleCount >= 5 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex flex-wrap gap-2 justify-center w-full">
          <button 
            onClick={handleSaveImage} 
            disabled={saving} 
            className="bg-white text-black font-black text-sm px-6 py-2 rounded hover:bg-gray-200 transition-colors"
          >
            {saving ? 'Saving...' : 'Save (PNG)'}
          </button>
          
          <button 
            onClick={() => onRetry(lockedIndices)} 
            className="bg-[#FF4655] text-white font-black text-sm px-8 py-2 rounded hover:bg-[#ff5e6a] transition-colors"
          >
            　RE-ROLL　
          </button>

          <button 
            onClick={onViewMap} 
            className="bg-[#172129] border border-white/20 text-white font-black text-sm px-8 py-2 rounded hover:bg-[#222d37] transition-colors"
          >
            SELECT MAP
          </button>
          
          <button 
            onClick={onViewBinds} 
            className="border border-white/20 text-white/60 font-bold text-sm px-6 py-2 rounded hover:bg-white/5 hover:text-white transition-all"
          >
            View Binds List
          </button>
        </div>

        {/* ✅ フッターの導線ボタン */}
        <div className="mt-6 flex items-center gap-12 border-t border-white/5 pt-6 w-full max-w-lg justify-center">
          <button 
            onClick={() => window.location.reload()} 
            className="text-[11px] font-black uppercase tracking-widest text-white/90 hover:text-white transition-colors"
          >
            ← Back to HOME
          </button>
          
          <button 
            onClick={onNavigateToSubmit}
            className="text-[11px] font-black italic uppercase tracking-[0.2em] text-cyan-500/70 hover:text-cyan-400 transition-all"
          >
            Suggest a New Bind →
          </button>
        </div>
      </div>
    </div>
  );
}