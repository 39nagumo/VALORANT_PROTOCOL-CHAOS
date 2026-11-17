import { useRef, useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { GachaResult } from '../logic/gacha';
import { AgentCard } from './AgentCard';
import { btnBlue, btnGhost, btnLight, btnPrimary } from '../ui/lobby';

// 見た目どおりに画像化するため、ブラウザ自身の描画を使う html-to-image で保存する
import { toPng } from 'html-to-image';

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
  const navigate = useNavigate();
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
    
    const el = containerRef.current;
    // 保存中だけ、カードの登場アニメーションを止めて最終の見た目にする
    el.classList.add('cr-capturing');
    try {
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        backgroundColor: '#101418',
        cacheBust: false,
        // 鍵・振り直しのボタンは画像に入れない
        filter: node => !(node instanceof HTMLElement && node.hasAttribute('data-html2canvas-ignore')),
      });
      const link = document.createElement('a');
      link.download = `valorant-chaos-gacha-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Failed to capture', e);
    } finally {
      el.classList.remove('cr-capturing');
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 items-center w-full max-w-[1400px] mx-auto">
      <div className="w-fit max-w-full flex flex-col gap-4">
      {/* 攻めと守りの切り替え（画像には入れない）。左が攻め・右が守り */}
      <div className="flex w-full">
        <button
          onClick={() => setSide('ATTACKER')}
          className={`flex-1 h-12 flex items-center justify-center text-lg font-extrabold transition-colors ${
            side === 'ATTACKER' ? 'bg-[#ff4655] text-white' : 'bg-[#1a2027] text-[#9aa3ad] hover:text-[#ece8e1]'
          }`}
        >
          ATTACKER
        </button>
        <button
          onClick={() => setSide('DEFENDER')}
          className={`flex-1 h-12 flex items-center justify-center text-lg font-extrabold transition-colors ${
            side === 'DEFENDER' ? 'bg-[#3fb7ec] text-[#101418]' : 'bg-[#1a2027] text-[#9aa3ad] hover:text-[#ece8e1]'
          }`}
        >
          DEFENDER
        </button>
      </div>

      {/* スマホではカードの並びを横にずらして見る（保存する画像の大きさは変えない） */}
      <div className="max-w-full overflow-x-auto">
      <div
        ref={containerRef}
        className="bg-[#101418] p-4 md:p-5 relative overflow-hidden"
        style={{ minWidth: '1100px' }}
      >
        <div className="absolute top-2 right-3 text-[11px] text-[#9aa3ad]/60 font-bold">
          シード {initialResult.seed}
        </div>

        <div className="mb-4 text-center">
          <div className="cr-theme flex justify-center pt-2 pb-1">
            <div className={`cr-tag cr-tag-sm cr-tag-${side === 'ATTACKER' ? 'ATK' : 'DEF'}`}>{side}</div>
          </div>
          <p className="text-sm text-[#9aa3ad] mt-2 font-bold">
            エージェントと縛りが1人1つずつ
          </p>
        </div>

        <section className="w-full">
          <div className="grid grid-cols-5 gap-4 px-1 pb-3">
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

        <div className="mt-4 text-center text-[11px] font-bold text-[#9aa3ad]/50">
          VALORANT CHAOSガチャ
        </div>
      </div>
      </div>
      </div>

      <div className={`flex flex-col items-center gap-2 w-full mt-2 transition-opacity duration-1000 ${visibleCount >= 5 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex flex-wrap gap-2 justify-center w-full">
          <button onClick={() => onRetry(lockedIndices)} className={btnPrimary}>
            振り直す
          </button>
          <button onClick={handleSaveImage} disabled={saving} className={btnLight}>
            {saving ? '保存中…' : '画像を保存'}
          </button>
          <button onClick={onViewMap} className={btnBlue}>
            マップを選ぶ
          </button>
        </div>
        <p className="text-xs text-[#9aa3ad] mt-1">鍵をかけた縛りは「振り直す」で変わりません</p>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-6 w-full max-w-lg justify-center">
          <button onClick={() => navigate("/")} className={btnGhost}>
            トップへ戻る
          </button>
          <button onClick={onViewBinds} className={btnGhost}>
            縛り一覧
          </button>
          <button onClick={onNavigateToSubmit} className={btnGhost}>
            縛りを投稿
          </button>
        </div>
      </div>
    </div>
  );
}