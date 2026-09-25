import { useNavigate } from 'react-router-dom';
import { SubLinks } from './SubLinks';

const STEPS = [
  { no: '01', label: 'SQUAD', title: '名前を入れる', text: ['カスタムに参加する5人の名前を入力。', '空欄のままでも回せます。'] },
  { no: '02', label: 'GACHA', title: 'ガチャを回す', text: ['4ロールがそろうようにエージェントを割り振り、', '1人1つずつ縛りが決まります。', '縛りもエージェントも、個別再抽選ができます。'] },
  { no: '03', label: 'SHARE', title: '結果を共有する', text: ['結果は画像で保存してDiscordでみんなへ共有。', 'マップもガチャで決められます。'] },
];

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 max-w-5xl mx-auto">
      <section className="text-center mt-4 mb-14">
        <p className="text-[#FF4655] text-[11px] font-black tracking-[0.5em] uppercase mb-5">Valorant Custom Randomizer</p>
        <h1 className="text-3xl md:text-5xl font-black italic tracking-tight leading-tight mb-6">
          カスタムを、<span className="text-[#FF4655]">もっとカオスに。</span>
        </h1>
        <p className="text-gray-400 text-sm md:text-base leading-relaxed max-w-xl mx-auto [word-break:auto-phrase]">
          5人の名前を入れるだけで、エージェントと縛りプレイをランダムに決定。<br className="hidden md:block" />
          いつものカスタムが、笑いの絶えない試合に変わります。
        </p>

        <button
          onClick={() => navigate('/gacha')}
          className="mt-10 bg-[#FF4655] hover:bg-[#D93645] text-white font-black py-4 px-14 uppercase tracking-[0.3em] text-sm transition-all transform hover:-translate-y-0.5 active:translate-y-0 shadow-[0_4px_0_#9d1c28]"
        >
          ガチャを始める
        </button>
      </section>

      <section>
        <h2 className="text-center text-xs font-black uppercase tracking-[0.4em] text-gray-500 mb-6">How to Play</h2>
        <ol className="grid md:grid-cols-3 gap-4">
          {STEPS.map(step => (
            <li key={step.no} className="relative bg-[#172129]/90 border border-white/10 p-6 backdrop-blur-sm">
              <div className="absolute top-0 left-0 w-6 h-px bg-[#FF4655]" />
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-[#FF4655] font-black text-2xl italic">{step.no}</span>
                <span className="text-[10px] font-black tracking-[0.3em] text-gray-500">{step.label}</span>
              </div>
              <h3 className="text-lg font-black mb-2">{step.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed [word-break:auto-phrase]">
                {step.text.map((line, i) => <span key={i} className="block">{line}</span>)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <SubLinks />
    </div>
  );
}
