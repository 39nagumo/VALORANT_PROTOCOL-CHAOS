import { useState, useEffect, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import { MAPS } from '../data/maps';
import { backLink, btnGhost, pageTitle } from '../ui/lobby';


interface Props {
  onBack: () => void;
}

export function MapGacha({ onBack }: Props) {
  const navigate = useNavigate();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [mode, setMode] = useState<'PICK' | 'BAN'>('PICK');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  
  const [isRolling, setIsRolling] = useState(false);
  const [hasStartedAtLeastOnce, setHasStartedAtLeastOnce] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [finalPick, setFinalPick] = useState<string | null>(null);
  const [timerProgress, setTimerProgress] = useState(0);
  const [showLatestAsBright, setShowLatestAsBright] = useState(true);
  
  const progressIntervalRef = useRef<number | null>(null);

  const availableMaps = mode === 'BAN' 
    ? MAPS.filter(m => !selectedIds.includes(m.id) && !pickedIds.includes(m.id))
    : MAPS.filter(m => selectedIds.includes(m.id) && !pickedIds.includes(m.id));

  const lastPickedId = (pickedIds.length > 0 && showLatestAsBright) ? pickedIds[pickedIds.length - 1] : null;

  const toggleSelect = (id: string) => {
    if (isRolling || pickedIds.includes(id) || finalPick) return;
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const startRoll = () => {
    if (availableMaps.length < 2 || isRolling) return;
    
    setHasStartedAtLeastOnce(true);
    setShowLatestAsBright(false);
    setIsRolling(true);
    setFinalPick(null);
    setTimerProgress(0);

    let count = 0;
    const maxCount = 25;
    const interval = setInterval(() => {
      const randomAvailableMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];
      const highlightIdx = MAPS.findIndex(m => m.id === randomAvailableMap.id);
      setCurrentIndex(highlightIdx);
      count++;
      if (count >= maxCount) {
        clearInterval(interval);
        const result = availableMaps[Math.floor(Math.random() * availableMaps.length)];
        const finalIdx = MAPS.findIndex(m => m.id === result.id);
        setCurrentIndex(finalIdx);
        setFinalPick(result.id);
        setIsRolling(false);
      }
    }, 120);
  };

  useEffect(() => {
    if (finalPick) {
      const startTime = Date.now();
      const duration = 5000;
      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const percent = Math.min((elapsed / duration) * 100, 100);
        setTimerProgress(percent);
        if (percent >= 100) confirmPick();
      }, 50);
      return () => { if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); };
    }
  }, [finalPick]);

  const confirmPick = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (finalPick) {
      setPickedIds(current => [...current, finalPick]);
      if (mode === 'PICK') setSelectedIds(prev => prev.filter(id => id !== finalPick));
      setShowLatestAsBright(true);
    }
    setFinalPick(null);
    setCurrentIndex(null);
    setTimerProgress(0);
  };

  const resetAll = () => {
    if (isRolling) return;
    setSelectedIds([]);
    setPickedIds([]);
    setFinalPick(null);
    setCurrentIndex(null);
    setTimerProgress(0);
    setShowLatestAsBright(true);
    setHasStartedAtLeastOnce(false);
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes image-zoom-pulse {
          0%, 100% { transform: scale(1.05); }
          50% { transform: scale(1.1); }
        }
        .animate-image-pulse {
          animation: image-zoom-pulse 1.5s ease-in-out infinite;
        }
      `}} />

      <header className="mb-6">
        <button onClick={onBack} className={`${backLink} mb-3`}>
          ← 戻る
        </button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className={pageTitle}>マップ抽選</h2>
          <button onClick={resetAll} className={btnGhost}>
            最初からやり直す
          </button>
        </div>
      </header>

      {/* 選び方：PICK＝押したマップから選ぶ／BAN＝押したマップを外す */}
      <div className="flex mb-6">
        <button
          onClick={() => { resetAll(); setMode('PICK'); }}
          className={`flex-1 min-h-14 py-2 flex flex-col sm:flex-row items-center justify-center gap-0 sm:gap-3 font-extrabold transition-colors ${
            mode === 'PICK' ? 'bg-[#ff4655] text-white' : 'bg-[#1a2027] text-[#9aa3ad] hover:text-[#ece8e1]'
          }`}
        >
          <span className="text-lg">PICK</span><span className="text-sm font-bold">押したマップから選ぶ</span>
        </button>
        <button
          onClick={() => { resetAll(); setMode('BAN'); }}
          className={`flex-1 min-h-14 py-2 flex flex-col sm:flex-row items-center justify-center gap-0 sm:gap-3 font-extrabold transition-colors ${
            mode === 'BAN' ? 'bg-[#3fb7ec] text-[#101418]' : 'bg-[#1a2027] text-[#9aa3ad] hover:text-[#ece8e1]'
          }`}
        >
          <span className="text-lg">BAN</span><span className="text-sm font-bold">押したマップを外す</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-10">
        {MAPS.map((map, idx) => {
          const isSelected = selectedIds.includes(map.id);
          const isPicked = pickedIds.includes(map.id);
          const isLatestPick = lastPickedId === map.id;
          const isHighlight = currentIndex === idx;
          const isResult = finalPick === map.id;
          
          const isExcluded = hasStartedAtLeastOnce && !availableMaps.some(m => m.id === map.id) && !isPicked && !isHighlight && !isResult;

          return (
            <div
              key={map.id}
              onClick={() => toggleSelect(map.id)}
              className={`
                w-[calc((100%-0.5rem)/2)] md:w-[calc((100%-1rem)/3)] lg:w-[calc((100%-2rem)/5)]
                relative aspect-video flex items-end justify-center border-[3px] transition-all duration-200 cursor-pointer overflow-hidden
                ${isExcluded ? 'border-transparent grayscale opacity-40' : 'border-transparent hover:border-white/30'}
                ${mode === 'PICK' && isSelected && !isPicked ? '!border-[#ff4655]' : ''}
                ${isPicked ? (isLatestPick ? '!border-[#ff4655]' : 'border-[#ff4655]/30 grayscale-[0.4]') : ''}
                ${isHighlight ? '!border-white z-10 !grayscale-0 !opacity-100' : ''}
                ${isResult ? '!border-[#ffd83b] z-20 !grayscale-0 !opacity-100' : ''}
              `}
            >
              <img 
                src={`/assets/maps/${map.file}.png`} 
                alt={map.name} 
                className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 
                  ${isResult ? 'animate-image-pulse' : isHighlight ? 'scale-105' : 'scale-100'}
                  ${mode === 'BAN' && isSelected ? 'grayscale' : ''}
                `} 
              />
              
              <div className={`absolute inset-0 transition-colors ${
                mode === 'BAN' && isSelected ? 'bg-[#101418]/75' :
                isPicked ? (isLatestPick ? 'bg-black/30' : 'bg-black/60') :
                'bg-gradient-to-t from-black/70 via-transparent to-transparent'
              }`} />

              {/* BAN は灰色＋赤い斜線 */}
              {mode === 'BAN' && isSelected && (
                <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(-45deg, transparent 0 10px, rgba(255,70,85,0.45) 10px 12px)' }} />
              )}

              {mode === 'BAN' && isSelected && (
                <span className="absolute top-1.5 left-1.5 h-6 px-2 inline-flex items-center justify-center bg-[#101418] text-[#ff4655] text-xs font-extrabold">BAN</span>
              )}

              {isPicked && (
                <span className={`absolute top-1.5 left-1.5 h-6 px-2 inline-flex items-center justify-center text-xs font-extrabold ${
                  isLatestPick ? 'bg-[#ff4655] text-white' : 'bg-[#101418] text-[#ff4655]/70'
                }`}>決定</span>
              )}

              <div className={`relative z-10 mb-2 text-sm font-extrabold transition-colors ${
                isResult || (isPicked && isLatestPick) ? 'text-white' :
                isPicked ? 'text-[#ff4655]/70' :
                (mode === 'BAN' && isSelected) ? 'text-white/30' : 'text-white'
              }`}>
                {map.name}
              </div>

              {isHighlight && !isPicked && (
                <div className="absolute inset-0 border-4 border-white animate-pulse pointer-events-none" />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="w-full max-w-md relative">
          <button
            onClick={finalPick ? confirmPick : startRoll}
            disabled={isRolling || (availableMaps.length < 2 && !finalPick)}
            className={`
              w-full h-16 flex items-center justify-center font-extrabold transition-colors text-xl
              ${availableMaps.length < 2 && !finalPick ? 'bg-[#1a2027] text-[#9aa3ad] cursor-not-allowed' : 'bg-[#ff4655] text-white hover:bg-[#ff5e6b]'}
              ${isRolling ? 'animate-pulse' : ''}
            `}
          >
            {isRolling ? '抽選中…' : finalPick ? 'すぐに決定する' : availableMaps.length < 2 ? 'マップを2つ以上残してください' : 'マップを回す'}
          </button>

          {finalPick && (
            <div className="absolute -bottom-3 left-0 w-full h-1 bg-white/10 overflow-hidden">
              <div className="h-full bg-[#ff4655] transition-all duration-100 ease-linear" style={{ width: `${timerProgress}%` }} />
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm font-bold text-[#9aa3ad] bg-[#1a2027] px-6 py-3">
            <span>選び方 <span className={mode === 'PICK' ? 'text-[#ff4655]' : 'text-[#3fb7ec]'}>{mode}</span></span>
            <span>候補 <span className="text-[#ece8e1]">{availableMaps.length}</span></span>
            <span>決定済み <span className="text-[#ff4655]">{pickedIds.length}</span></span>
          </div>

          <button onClick={() => navigate("/")} className={backLink}>
            トップへ戻る
          </button>
        </div>
      </div>
    </div>
  );
}