import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SubLinks } from './SubLinks';
import { createRoom } from '../room/connection';

const STEPS = [
  { no: '01', label: 'ROOM', title: 'ルームを作る', text: ['ルームを作って、招待リンクをDiscordに貼るだけ。', '参加した人の名前が名簿に並びます。'] },
  { no: '02', label: 'GACHA', title: 'みんなで回す', text: ['ATKとDEFに5人ずつ振り分けて抽選。', 'エージェントと縛りが1人1つずつ決まり、', '1人だけの振り直しもできます。'] },
  { no: '03', label: 'OBS', title: '配信に映す', text: ['OBSにURLを1回登録するだけ。', '抽選の演出が流れ、試合中は自分の縛りが', 'ミニマップの下に出続けます。'] },
];

export function LandingPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const startRoom = async () => {
    setBusy(true); setFailed(null);
    try { navigate(`/r/${await createRoom()}`, { state: { howto: true } }); } catch (e) { setFailed((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 max-w-5xl mx-auto">
      <section className="text-center mt-4 mb-14">
        <p className="text-[#FF4655] text-[11px] font-black tracking-[0.5em] uppercase mb-5">Valorant Custom Randomizer</p>
        <h1 className="text-3xl md:text-5xl font-black italic tracking-tight leading-tight mb-6">
          カスタムを、<span className="text-[#FF4655]">もっとカオスに。</span>
        </h1>
        <p className="text-gray-400 text-sm md:text-base leading-relaxed max-w-xl mx-auto [word-break:auto-phrase]">
          エージェントと縛りプレイをランダムに決定。ルームを作ってリンクを共有すれば、<br className="hidden md:block" />
          みんなの画面と配信に同じ抽選結果が出ます。いつものカスタムが、笑いの絶えない試合に。
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={startRoom}
            disabled={busy}
            className="bg-[#FF4655] hover:bg-[#D93645] text-white font-black py-4 px-14 tracking-[0.3em] text-sm transition-all transform hover:-translate-y-0.5 active:translate-y-0 shadow-[0_4px_0_#9d1c28] disabled:opacity-60"
          >
            {busy ? '作成中…' : 'ルームを作る'}
          </button>
          <button
            onClick={() => navigate('/gacha')}
            className="border border-white/25 hover:border-white/60 hover:bg-white/5 text-white/85 font-black py-4 px-10 tracking-[0.3em] text-sm transition-all"
          >
            ひとりで回す
          </button>
        </div>
        <p className="mt-4 text-xs text-gray-500 leading-relaxed [word-break:auto-phrase]">
          ルーム＝みんなで同じ結果を見る・配信に映す　／　ひとりで回す＝今までどおり画像で共有<br />
          ルームの操作は代表1人でOK。ほかの人は参加してOBSにURLを入れるだけです。<br />
          ルームを短時間に作りすぎると、しばらく作れなくなります。
        </p>
        {failed && <p className="text-[#FF4655] text-sm mt-3">{failed}</p>}
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
