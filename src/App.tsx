import { useState, useCallback, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { GachaSystem, GachaResult, Bind } from './logic/gacha';
import { GachaForm } from './components/GachaForm';
import { GachaResultView } from './components/GachaResultView';
import { BindsGallery } from './components/BindsGallery';
import { MapGacha } from './components/MapGacha';
import { SubmissionPage } from './components/SubmissionPage';
import { LandingPage } from './components/LandingPage';
import { SubLinks } from './components/SubLinks';
import { CreateRoomButton, RoomPage } from './room/RoomPage';
const logoImg = "/assets/CHAOS_fix.png";

// 上の帯から行ける画面（ページ構成は今までと同じ）
const NAV = [
  { to: '/gacha', label: 'ひとりで回す' },
  { to: '/maps', label: 'マップ抽選' },
  { to: '/binds', label: '縛り一覧' },
  { to: '/submit', label: '縛りを投稿' },
];

const SITE_TITLE = 'VALORANT Custom CHAOS Gacha';
const PAGE_TITLES: Record<string, string> = {
  '/gacha': 'ガチャ',
  '/result': 'ガチャ結果',
  '/maps': 'マップ選択',
  '/binds': '縛り一覧',
  '/submit': '縛りの投稿',
};

// ✅ 再読み込みやブラウザバックで結果が消えないよう、タブ内に一時保存する
const STORAGE_KEY = 'chaos-gacha:session';

function loadSession(): { result: GachaResult | null; names: string[] } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // 保存できない環境では何もしない
  }
  return { result: null, names: ['', '', '', '', ''] };
}

function saveSession(result: GachaResult | null, names: string[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ result, names }));
  } catch {
    // 保存できない環境では何もしない
  }
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const [result, setResult] = useState<GachaResult | null>(() => loadSession().result);
  const [loading, setLoading] = useState(false);
  const [currentNames, setCurrentNames] = useState<string[]>(() => loadSession().names);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    const page = PAGE_TITLES[path] ?? (path.startsWith('/r/') ? 'ルーム' : undefined);
    document.title = page ? `${page} | ${SITE_TITLE}` : SITE_TITLE;
  }, [path]);

  useEffect(() => {
    saveSession(result, currentNames);
  }, [result, currentNames]);

  // ✅ サイト内から来た場合は1つ前へ、URL直打ちなどで履歴がない場合は代わりの画面へ
  const goBack = (fallback: string) => {
    if (location.key !== 'default') navigate(-1);
    else navigate(fallback);
  };
  const backFallback = result ? '/result' : '/';

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
      // ✅ 結果画面での引き直しは履歴を増やさない
      navigate('/result', { replace: path === '/result' });
    } catch (error) {
      console.error("Gacha execution failed:", error);
    } finally {
      setLoading(false);
    }
  }, [loading, result, navigate, path]);

  const handleReRollAll = (lockedIndices: number[]) => {
    if (!result) return;
    handleRunGacha(currentNames, lockedIndices, result.binds);
  };

  const handleUpdateResult = (newResult: GachaResult) => {
    setShouldAnimate(false);
    setResult(newResult);
  };

  // トップはロゴを大きな帯（ヒーロー）の中に置くので、上の見出しは出さない
  const isTop = path === '/';
  const isRoom = path.startsWith('/r/');

  return (
    <div className="min-h-screen bg-[#101418] text-[#ece8e1] font-lobby selection:bg-[#ff4655] selection:text-white overflow-x-hidden relative">
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
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#101418]/95">
          {/* 攻めの赤と守りの青が左右から寄ってくる */}
          <div className="relative w-64 h-2 overflow-hidden bg-white/10">
            <div className="absolute inset-y-0 left-0 w-1/2 bg-[#ff4655] animate-pulse" />
            <div className="absolute inset-y-0 right-0 w-1/2 bg-[#3fb7ec] animate-pulse" />
          </div>
          <p className="mt-5 text-xl font-extrabold">抽選中…</p>
        </div>
      )}

      {!isTop && (
        <header className="relative z-0 bg-[#0b0e11] border-b border-white/10">
          <div className={`mx-auto px-4 h-16 md:h-20 flex items-center gap-6 ${isRoom ? 'max-w-[1760px]' : 'max-w-7xl'}`}>
            <button type="button" onClick={() => navigate('/')} className="h-full py-2" aria-label="トップへ">
              <img src={logoImg} alt="CHAOS GACHA" className="h-full w-auto object-contain" />
            </button>
            <nav className="ml-auto hidden sm:flex items-stretch h-full text-sm font-bold">
              {NAV.map(item => (
                <button key={item.to} type="button" onClick={() => navigate(item.to)}
                  className={`px-4 flex items-center border-b-2 transition-colors ${path === item.to ? 'border-[#ff4655] text-[#ece8e1]' : 'border-transparent text-[#9aa3ad] hover:text-[#ece8e1]'}`}>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </header>
      )}

      <main className={`relative z-10 mx-auto px-4 min-h-screen flex flex-col ${isTop ? 'max-w-none px-0' : isRoom ? 'max-w-[1760px] py-4' : 'max-w-7xl py-8'}`}>

        <div className="flex-grow">
          <Routes>
            <Route path="/" element={<LandingPage />} />

            <Route path="/gacha" element={
              <div className="max-w-2xl mx-auto w-full">
                <GachaForm onSubmit={(names) => handleRunGacha(names)} loading={loading} initialNames={currentNames} />
                <CreateRoomButton />
                <SubLinks />
              </div>
            } />

            <Route path="/r/:roomId" element={<RoomPage />} />

            <Route path="/result" element={result ? (
              <div className="animate-in fade-in zoom-in-95 duration-700">
                <GachaResultView
                  result={result}
                  onRetry={handleReRollAll}
                  onUpdateResult={handleUpdateResult}
                  onViewBinds={() => navigate('/binds')}
                  onViewMap={() => navigate('/maps')}
                  onNavigateToSubmit={() => navigate('/submit')}
                  shouldAnimate={shouldAnimate}
                />
              </div>
            ) : <Navigate to="/gacha" replace />} />

            <Route path="/binds" element={
              <div className="animate-in slide-in-from-bottom-8 duration-700 h-full">
                <BindsGallery
                  onBack={() => goBack(backFallback)}
                  onNavigateToSubmit={() => navigate('/submit')}
                />
              </div>
            } />

            <Route path="/maps" element={
              <div className="animate-in slide-in-from-right-8 duration-700">
                <MapGacha onBack={() => goBack(backFallback)} />
              </div>
            } />

            <Route path="/submit" element={
              <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                <SubmissionPage onBack={() => goBack('/')} />
              </div>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        <footer className="mt-auto pt-16 pb-10 px-4">
          <div className="max-w-3xl mx-auto border-t border-white/10 pt-6 text-center text-[11px] leading-relaxed text-[#9aa3ad]/70">
            <p className="mb-1">本サイトはファン制作の非公式サイトです。使用されているゲーム画像や商標等の知的財産は、すべてライアットゲームズ社に帰属します。</p>
            <p>VALORANT CHAOS GACHA isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.</p>
            <p className="mt-4 text-xs">
              作った人：<a href="https://x.com/39nagumo" target="_blank" rel="noopener noreferrer" className="font-bold text-[#ece8e1] hover:text-[#ff4655]">南雲 朔（@39nagumo）</a>
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
