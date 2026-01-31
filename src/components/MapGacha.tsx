import { useState, useEffect, useRef } from 'react';

const MAPS = [
  { id: 'ascent', name: 'ASCENT', file: 'map_01_Ascent' },
  { id: 'bind', name: 'BIND', file: 'map_02_Bind' },
  { id: 'haven', name: 'HAVEN', file: 'map_03_Haven' },
  { id: 'split', name: 'SPLIT', file: 'map_04_Split' },
  { id: 'icebox', name: 'ICEBOX', file: 'map_05_Icebox' },
  { id: 'breeze', name: 'BREEZE', file: 'map_06_Breeze' },
  { id: 'fracture', name: 'FRACTURE', file: 'map_07_Fracture' },
  { id: 'pearl', name: 'PEARL', file: 'map_08_Pearl' },
  { id: 'lotus', name: 'LOTUS', file: 'map_09_Lotus' },
  { id: 'sunset', name: 'SUNSET', file: 'map_10_Sunset' },
  { id: 'abyss', name: 'ABYSS', file: 'map_11_Abyss' },
  { id: 'corrode', name: 'CORRODE', file: 'map_12_Corrode' }
];

interface Props {
  onBack: () => void;
}

export function MapGacha({ onBack }: Props) {
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

      <header className="mb-8 flex justify-between items-end border-b border-white/10 pb-4">
        <div>
          <button onClick={onBack} className="text-xs text-gray-400 hover:text-white transition-colors mb-2 block uppercase tracking-[0.2em] font-bold">
            ← Back to Gacha
          </button>
          <div className="flex items-center gap-6">
            <h2 className="text-4xl font-black italic uppercase tracking-tighter">MAP <span className="text-[#FF4655]">SELECTION</span></h2>
            
            <div className="flex bg-black/40 p-1 rounded border border-white/10 mb-1">
              <button
                onClick={() => { resetAll(); setMode('PICK'); }}
                className={`px-4 py-1 text-[11px] font-black tracking-widest transition-all ${
                  mode === 'PICK' ? 'bg-[#FF4655] text-white' : 'text-white/40 hover:text-white'
                }`}
              >
                PICK
              </button>
              <button
                onClick={() => { resetAll(); setMode('BAN'); }}
                className={`px-4 py-1 text-[11px] font-black tracking-widest transition-all ${
                  mode === 'BAN' ? 'bg-[#46CBFF] text-white' : 'text-white/40 hover:text-white'
                }`}
              >
                BAN
              </button>
            </div>
          </div>
        </div>
        <button onClick={resetAll} className="text-[10px] font-black border border-white/20 px-6 py-2 hover:bg-[#FF4655] hover:text-white hover:border-[#FF4655] transition-all uppercase tracking-widest text-gray-500">
          Reset All Data
        </button>
      </header>

      <div className="grid grid-cols-4 gap-4 mb-10">
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
                relative aspect-video flex items-end justify-center border-2 transition-all duration-200 cursor-pointer overflow-hidden
                ${isExcluded ? 'border-transparent grayscale opacity-40' : 'border-white/10 hover:border-white/30'}
                ${mode === 'PICK' && isSelected && !isPicked ? 'border-[#FF4655] shadow-[inset_0_0_15px_rgba(255,70,85,0.4)] ring-1 ring-[#FF4655]' : ''}
                ${isPicked ? (isLatestPick ? 'border-[#FF4655]/60 shadow-[0_0_15px_rgba(255,70,85,0.2)]' : 'border-[#FF4655]/20 grayscale-[0.4]') : ''}
                ${isHighlight ? 'border-white scale-[1.02] z-10 shadow-[0_0_20px_rgba(255,255,255,0.3)] !grayscale-0 !opacity-100' : ''}
                ${isResult ? 'border-[#FF4655] z-20 shadow-[0_0_40px_rgba(255,70,85,0.5)] !grayscale-0 !opacity-100' : ''}
              `}
            >
              <img 
                src={`/assets/maps/${map.file}.png`} 
                alt={map.name} 
                className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 
                  ${isResult ? 'animate-image-pulse' : isHighlight ? 'scale-105' : 'scale-100'}
                `} 
              />
              
              <div className={`absolute inset-0 transition-colors ${
                mode === 'BAN' && isSelected ? 'bg-black/80' : 
                isPicked ? (isLatestPick ? 'bg-black/40' : 'bg-black/70') : 
                'bg-gradient-to-t from-black/80 via-transparent to-transparent'
              }`} />
              
              {mode === 'BAN' && isSelected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-gray-600/40 text-white/50 text-[10px] font-black px-4 py-1 rotate-[-12deg] tracking-[0.2em] border border-white/5">BANNED</div>
                </div>
              )}

              {isPicked && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`text-[10px] font-black px-4 py-1 rotate-[-12deg] tracking-[0.2em] border ${
                    isLatestPick ? 'bg-[#FF4655] text-white border-[#FF4655]' : 'bg-[#FF4655]/20 text-[#FF4655]/70 border-[#FF4655]/40'
                  }`}>PICKED</div>
                </div>
              )}

              <div className={`relative z-10 mb-2 text-sm font-black tracking-[0.1em] transition-colors ${
                isResult || (isPicked && isLatestPick) ? 'text-white' : 
                isPicked ? 'text-[#FF4655]/60' : 
                (mode === 'BAN' && isSelected) ? 'text-white/20' : 'text-white'
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
              w-full py-5 font-black tracking-[0.4em] uppercase transition-all text-lg
              ${availableMaps.length < 2 && !finalPick ? 'bg-white/5 text-gray-600 cursor-not-allowed' : 'bg-[#FF4655] text-white hover:bg-[#ff5e6a] shadow-[0_10px_20px_rgba(255,70,85,0.2)]'}
              ${isRolling ? 'animate-pulse' : ''}
            `}
          >
            {isRolling ? 'Shuffling Maps...' : finalPick ? 'Confirm Immediately' : availableMaps.length < 2 ? 'Need 2+ Maps' : 'Initiate Selection'}
          </button>

          {finalPick && (
            <div className="absolute -bottom-4 left-0 w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#FF4655] transition-all duration-100 ease-linear" style={{ width: `${timerProgress}%` }} />
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-8 text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-black/20 px-8 py-3 rounded-full border border-white/5">
            <span>Mode: <span className={mode === 'PICK' ? 'text-[#FF4655]' : 'text-[#46CBFF]'}>{mode}</span></span>
            <span>Target: <span className="text-white">{availableMaps.length}</span></span>
            <span>History: <span className="text-[#FF4655]/70">{pickedIds.length}</span></span>
          </div>

          <button 
            onClick={() => window.location.reload()} 
            className="text-xs text-white/60 hover:text-white underline transition-colors uppercase tracking-widest"
          >
            ← Back to HOME
          </button>
        </div>
      </div>
    </div>
  );
}