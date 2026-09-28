import { PlayerResult, BindRarity } from '../logic/gacha';
import { useState, type CSSProperties } from 'react';
import { BindText, bindFontSize, RarityBadge, RARITY_COLOR, ROLE_LABEL } from '../room/reveal';
import { RoleIcon } from '../room/RoleIcon';

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

/** ひとりで回すときの結果カード。見た目はルーム（OBS）の演出と同じデザインにそろえている */
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
  const rarity = bindRarity as BindRarity | undefined;

  const handleLockClick = () => {
    if (onToggleLock) {
      onToggleLock();
      if (!isLocked) {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 300);
      }
    }
  };

  return (
    <div
      className="cr-theme opacity-0 translate-y-4 animate-card-in"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'forwards' }}
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
      `}} />

      <div className="cr-slot cr-solo" style={{ '--rc': rarity ? RARITY_COLOR[rarity] : 'rgba(255,255,255,.2)' } as CSSProperties}>
        <div className="cr-card">
          <div className="cr-art">
            <img src={player.agent.image} alt={player.agent.name} />
            <div className="cr-art-fade" />
            <div className="cr-pname">{player.playerName}</div>
            <button
              onClick={(e) => { e.stopPropagation(); onRerollAgent(); }}
              className="cr-solo-btn cr-solo-btn-agent" title="エージェントを振り直す" data-html2canvas-ignore
            >↻</button>
            <div className="cr-agent">
              <span className="cr-role"><RoleIcon role={player.agent.role} size={18} />{ROLE_LABEL[player.agent.role]}</span>
              <span className="cr-aname">{player.agent.name}</span>
            </div>
          </div>

          <div className={`cr-bind ${rarity === 'CHAOS' ? 'cr-bind-CHAOS' : ''} ${isLocked ? 'cr-solo-locked' : ''} ${isShaking ? 'animate-simple-shake' : ''}`}>
            {onToggleLock && (
              <button
                onClick={(e) => { e.stopPropagation(); handleLockClick(); }}
                className={`cr-solo-btn cr-solo-btn-lock ${isLocked ? 'is-on' : ''}`}
                title={isLocked ? '鍵を外す' : 'この縛りを残す（全体の振り直しで変わらない）'} data-html2canvas-ignore
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={isLocked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
            )}
            {!isLocked && (
              <button
                onClick={(e) => { e.stopPropagation(); onRerollBind(); }}
                className="cr-solo-btn cr-solo-btn-bind" title="縛りを振り直す" data-html2canvas-ignore
              >↻</button>
            )}
            {rarity && bindText ? (
              <>
                <RarityBadge rarity={rarity} />
                <BindText text={bindText} size={bindFontSize(bindText, 17)} />
              </>
            ) : (
              <p className="text-white/40 text-sm mt-8">No constraint</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
