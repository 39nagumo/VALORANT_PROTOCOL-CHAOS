import { PlayerResult } from '../logic/gacha';
import { useState } from 'react';

interface Props {
  player: PlayerResult;
  bindText?: string;
  bindRarity?: string;
  index?: number;
  onRerollAgent: () => void;
  onRerollBind: () => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
}

export function AgentCard({ 
  player, 
  bindText, 
  bindRarity, 
  index = 0, 
  onRerollAgent, 
  onRerollBind,
  isLocked = false,
  onToggleLock
}: Props) {
  const [isShaking, setIsShaking] = useState(false);
  const roleLabel = player.agent.role;

  const handleLockClick = () => {
    if (onToggleLock) {
      onToggleLock();
      if (!isLocked) {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 300);
      }
    }
  };

  const roleText = (role?: string) => {
    switch (role) {
      case 'Duelist': return 'text-yellow-300';
      case 'Initiator': return 'text-pink-300';
      case 'Controller': return 'text-purple-300';
      case 'Sentinel': return 'text-cyan-300';
      default: return 'text-white/70';
    }
  };

  const bindTone = (rarity?: string) => {
    const base = 'rounded-lg border px-1.5 py-2 transition-all h-full flex flex-col justify-start items-center relative group backdrop-blur-sm';
    const lockClass = isLocked ? 'border-amber-500/50 bg-amber-950/40 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'border-white/5 bg-black/40';
    const shakeClass = isShaking ? 'animate-simple-shake' : '';
    
    switch (rarity) {
      case 'CHAOS':
        return `${base} border-[#FF4655]/40 bg-[#120506]/80 text-[#FFE9EC] shadow-[0_0_15px_rgba(255,70,85,0.1)] ${isLocked ? 'ring-1 ring-amber-500/50' : ''} ${shakeClass}`;
      default:
        return `${base} text-white/90 ${lockClass} ${shakeClass}`;
    }
  };

  const rarityBadge = (rarity?: string) => {
    const base = 'inline-flex items-center justify-center rounded-md border px-3 py-1.5 min-h-[24px] text-[10px] md:text-xs font-black uppercase tracking-[0.15em] mb-3 shrink-0 leading-relaxed';
    switch (rarity) {
      case 'CHAOS': return `${base} border-[#FF4655]/70 bg-[#FF4655]/20 text-[#FFE9EC]`;
      case 'Epic': return `${base} border-purple-400/45 bg-purple-400/15 text-purple-100`;
      case 'Exotic': return `${base} border-green-400/45 bg-green-400/15 text-green-100`;
      case 'Extra': return `${base} border-yellow-400/45 bg-yellow-400/15 text-yellow-100`;
      case 'Unique': return `${base} border-pink-400/45 bg-pink-400/15 text-pink-100`;
      case 'Special': return `${base} border-cyan-400/45 bg-cyan-400/15 text-cyan-100`;
      default: return `${base} border-white/20 bg-white/5 text-white/80`;
    }
  };

  return (
    <div 
      className="card-surface overflow-hidden w-full opacity-0 translate-y-4 animate-card-in"
      style={{ 
        animationDelay: `${index * 80}ms`,
        animationFillMode: 'forwards'
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes cardFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes simpleShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-1px); }
          75% { transform: translateX(1px); }
        }
        .animate-card-in { animation: cardFadeIn 0.6s cubic-bezier(0.22, 1, 0.36, 1); }
        .animate-simple-shake { animation: simpleShake 0.1s ease-in-out 3; }
        .agent-frame-fixed {
          width: 100% !important;
          aspect-ratio: 176 / 210 !important;
          position: relative !important;
          overflow: hidden !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          background: #000 !important;
        }
        .agent-frame-fixed img {
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          object-position: center top !important;
        }
        .bind-text-display {
          white-space: pre-wrap !important;
          word-break: break-word !important;
          line-height: 1.5 !important;
        }
      `}} />

      <div className="p-2 flex flex-col h-full bg-[#1A2531]">
        <div className="min-h-[85px] md:min-h-[95px] flex flex-col justify-between py-2 px-1">
          <div className="relative w-full">
            <div className="text-[15px] uppercase tracking-widest text-white/90 border-b border-white/10 pb-1 mb-2 truncate leading-relaxed font-bold">
              {player.playerName}
            </div>
            
            <h3 className="text-xl md:text-2xl font-black uppercase italic text-white truncate leading-[1.6] pt-1 pb-2 pr-10">
              {player.agent.name}
            </h3>

            <button 
              onClick={(e) => { e.stopPropagation(); onRerollAgent(); }}
              className="absolute right-0 bottom-2 p-1.5 text-white/30 hover:text-[#FF4655] hover:bg-white/5 rounded-full transition-all active:scale-90 z-10"
            >
              <span className="text-xl leading-none block transform hover:rotate-180 transition-transform duration-500">↻</span>
            </button>
          </div>
          <div className={`text-[12px] md:text-[13px] font-bold uppercase text-right leading-relaxed ${roleText(roleLabel)}`}>
            {roleLabel}
          </div>
        </div>

        <div className="mt-2 rounded-lg border border-white/10 agent-frame-fixed">
          <img
            src={player.agent.image}
            alt={player.agent.name}
          />
        </div>

        <div className="mt-2 min-h-[130px] md:min-h-[150px]">
          {bindText ? (
            <div className={bindTone(bindRarity)}>
              <button 
                onClick={(e) => { e.stopPropagation(); handleLockClick(); }}
                className={`absolute top-2 left-2 p-1.5 rounded-full transition-all active:scale-90 z-10 ${
                  isLocked ? 'text-amber-400 bg-amber-400/10' : 'text-white/20 hover:text-white hover:bg-white/10'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={isLocked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {isLocked ? (
                    <path d="M7 11V7a5 5 0 0 1 10 0v4M8 11h8a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z" />
                  ) : (
                    <g>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                    </g>
                  )}
                </svg>
              </button>

              {!isLocked && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onRerollBind(); }}
                  className="absolute top-2 right-2 p-1.5 text-white/20 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90 z-10"
                >
                  <span className="text-base leading-none block transform hover:rotate-180 transition-transform duration-500">↻</span>
                </button>
              )}

              <span className={rarityBadge(bindRarity)}>{bindRarity}</span>
              <div className="flex-grow flex items-center justify-center w-full px-1">
                <div className="bind-text-display text-[13px] md:text-[14px] font-bold text-white text-center w-full py-2">
                  {bindText}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center rounded-lg border border-white/10 bg-black/40 text-[12px] text-white/40 leading-relaxed">
              No constraint
            </div>
          )}
        </div>
      </div>
    </div>
  );
}