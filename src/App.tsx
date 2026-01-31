import { useState, useCallback, useEffect } from 'react';
import { GachaSystem, GachaResult, Bind } from './logic/gacha';
import { GachaForm } from './components/GachaForm';
import { GachaResultView } from './components/GachaResultView';
import { BindsGallery } from './components/BindsGallery';
import { MapGacha } from './components/MapGacha';
import { SubmissionPage } from './components/SubmissionPage';
const logoImg = "/assets/CHAOS_fix.png";

type ViewState = 'HOME' | 'RESULT' | 'GALLERY' | 'MAP' | 'SUBMIT';

function App() {
  const [view, setView] = useState<ViewState>('HOME');
  // ✅ 直前の画面を記録するためのStateを追加
  const [prevView, setPrevView] = useState<ViewState>('HOME');
  
  const [result, setResult] = useState<GachaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentNames, setCurrentNames] = useState<string[]>(['', '', '', '', '']);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // ✅ 画面遷移時に直前の画面を保存するラッパー関数
  const handleNavigate = (nextView: ViewState) => {
    setPrevView(view);
    setView(nextView);
  };

  const handleRunGacha = useCallback(async (names: string[], lockedIndices: number[] = [], latestBinds?: Bind[]) => {
    if (loading) return;
    setLoading(true);
    setCurrentNames(names);
    
    try {
      const finalNames = names.map((n, i) => n.trim() !== '' ? n : `Player ${i + 1}`);
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const system = new GachaSystem();
      const activeBinds = latestBinds || result?.binds;
      
      const lockedBinds = (activeBinds && lockedIndices.length > 0)
        ? lockedIndices.map(idx => ({ 
            index: idx, 
            bind: activeBinds[idx] 
          }))
        : undefined;

      const newRes = system.runGacha(finalNames, lockedBinds);
      
      setShouldAnimate(true);
      setResult(newRes);
      setView('RESULT');
    } catch (error) {
      console.error("Gacha execution failed:", error);
    } finally {
      setLoading(false);
    }
  }, [loading, result]);

  const handleReRollAll = (lockedIndices: number[]) => {
    if (!result) return;
    handleRunGacha(currentNames, lockedIndices, result.binds);
  };

  const handleUpdateResult = (newResult: GachaResult) => {
    setShouldAnimate(false);
    setResult(newResult);
  };

  return (
    <div className="min-h-screen bg-[#0F1923] text-[#ECE8E1] font-sans selection:bg-[#FF4655] selection:text-white overflow-x-hidden relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('/assets/val-bg-pattern.png')] bg-repeat opacity-[0.03]" />
        <div className="absolute top-[-10%] right-[-5%] w-[50%] h-[120%] bg-[#FF4655]/5 skew-x-[-12deg]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[30%] h-[100%] bg-white/[0.02] skew-x-[-12deg]" />
        <div className="absolute top-[20%] left-0 w-full h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        <div className="absolute top-[60%] left-0 w-full h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .bind-box-uniform, .min-h-\\[130px\\], .min-h-\\[150px\\] {
          height: 150px !important; 
          min-height: 150px !important;
          display: flex !important;
          flex-direction: column !important;
        }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        .animate-float { animation: float 4s ease-in-out infinite; }
        @keyframes cardFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />

      {loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F1923]/90 backdrop-blur-md">
          <div className="text-center">
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 border-[1px] border-white/10 rounded-full"></div>
              <div className="absolute inset-0 border-t-2 border-[#FF4655] rounded-full animate-spin"></div>
              <div className="absolute inset-[15%] border-[1px] border-white/5 rounded-full animate-pulse"></div>
            </div>
            <div className="text-[#FF4655] font-black text-sm tracking-[0.5em] uppercase animate-pulse">Initializing Protocol</div>
          </div>
        </div>
      )}

      <main className="relative z-10 container mx-auto px-4 py-8 max-w-7xl min-h-screen flex flex-col">
        <header className={`transition-all duration-700 ease-out ${view === 'RESULT' || view === 'MAP' || view === 'SUBMIT' || view === 'GALLERY' ? 'mb-4 text-left flex items-end gap-6' : 'mb-0 mt-0 text-center'}`}>
          <div className="inline-block relative">
            <img 
              src={logoImg} 
              alt="CHAOS GACHA LOGO" 
              className={`transition-all duration-500 object-contain mx-auto ${
                view === 'RESULT' || view === 'MAP' || view === 'SUBMIT' || view === 'GALLERY' 
                  ? 'h-16 md:h-20' 
                  : 'h-40 md:h-64' 
              }`} 
            />
          </div>
        </header>

        <div className="flex-grow">
          {view === 'HOME' && (
            <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 max-w-2xl mx-auto">
              <div className="relative group">
                <div className="absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2 border-[#FF4655] z-20" />
                <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2 border-[#FF4655] z-20" />
                <div className="relative bg-[#172129]/90 border border-white/10 p-8 md:p-12 backdrop-blur-2xl shadow-2xl">
                  <GachaForm onSubmit={(names) => handleRunGacha(names)} loading={loading} />
                </div>
              </div>
              
              <div className="mt-12 flex flex-wrap justify-center gap-8">
                <button onClick={() => handleNavigate('MAP')} className="group relative flex items-center gap-4 px-8 py-3 text-[11px] font-black tracking-[0.25em] uppercase transition-all">
                  <span className="relative z-10 text-white/40 group-hover:text-white transition-colors">Map Selection</span>
                  <div className="w-8 h-px bg-[#FF4655] relative z-10 group-hover:w-12 transition-all" />
                </button>
                <button onClick={() => handleNavigate('GALLERY')} className="group relative flex items-center gap-4 px-8 py-3 text-[11px] font-black tracking-[0.25em] uppercase transition-all">
                  <span className="relative z-10 text-white/40 group-hover:text-white transition-colors">Binds Database</span>
                  <div className="w-8 h-px bg-[#FF4655] relative z-10 group-hover:w-12 transition-all" />
                </button>
                <button onClick={() => handleNavigate('SUBMIT')} className="group relative flex items-center gap-4 px-8 py-3 text-[11px] font-black tracking-[0.25em] uppercase transition-all">
                  <span className="relative z-10 text-white/40 group-hover:text-white transition-colors">Suggest a Bind</span>
                  <div className="w-8 h-px bg-[#FF4655] relative z-10 group-hover:w-12 transition-all" />
                </button>
              </div>
            </div>
          )}

          {view === 'RESULT' && result && (
            <div className="animate-in fade-in zoom-in-95 duration-700">
              <GachaResultView 
                result={result} 
                onRetry={handleReRollAll} 
                onUpdateResult={handleUpdateResult}
                onViewBinds={() => handleNavigate('GALLERY')} 
                onViewMap={() => handleNavigate('MAP')} 
                onNavigateToSubmit={() => handleNavigate('SUBMIT')}
                shouldAnimate={shouldAnimate} 
              />
            </div>
          )}

          {view === 'GALLERY' && (
            <div className="animate-in slide-in-from-bottom-8 duration-700 h-full">
              <BindsGallery 
                onBack={() => setView(result ? 'RESULT' : 'HOME')} 
                onNavigateToSubmit={() => handleNavigate('SUBMIT')} 
              />
            </div>
          )}

          {view === 'MAP' && (
            <div className="animate-in slide-in-from-right-8 duration-700">
              <MapGacha onBack={() => setView(result ? 'RESULT' : 'HOME')} />
            </div>
          )}

          {view === 'SUBMIT' && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
              {/* ✅ onBackでprevViewへ戻るように修正 */}
              <SubmissionPage onBack={() => setView(prevView)} />
            </div>
          )}
        </div>

        <footer className="mt-auto py-12 text-center relative">
          <div className="max-w-4xl mx-auto px-4 opacity-40 hover:opacity-100 transition-opacity duration-500">
            <div className="text-[9px] text-gray-500 leading-relaxed text-center normal-case tracking-normal max-w-2xl mx-auto mb-8 border-t border-white/5 pt-8">
              <p className="mb-2">
                本サイトはファン制作の非公式サイトです。使用されているゲーム画像や商標等の知的財産は、すべてライアットゲームズ社に帰属します。
              </p>
              <p>
                VALORANT CHAOS GACHA isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 text-[10px] font-black tracking-[0.2em] text-gray-600">
              <p>© 2026 PROTOCOL:CHAOS</p>
              <a 
                href="https://x.com/39nagumo" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-[#FF4655] transition-colors duration-300 flex items-center justify-center gap-2 border border-white/5 px-4 py-2 bg-white/5"
              >
                AUTHOR // @39nagumo
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;