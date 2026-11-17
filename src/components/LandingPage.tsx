import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SubLinks } from './SubLinks';
import { createRoom } from '../room/connection';
import { btnLight, btnPrimary } from '../ui/lobby';

const logoImg = '/assets/CHAOS_fix.png';
const agent = (file: string) => `/public/agents/${file}.jpg`;
// 攻め（左・赤）と守り（右・青）に並べるエージェントの絵
const ATK_ART = ['30_Hush', '25_Reyna', '10_Jett'].map(agent);
const DEF_ART = ['09_Cypher', '12_Sage', '05_Omen'].map(agent);

const STEPS = [
  { title: 'ルームを作る', text: 'ルームを作って、招待リンクをDiscordに貼るだけ。参加した人の名前が名簿に並びます。' },
  { title: 'みんなで回す', text: 'ATKとDEFに5人ずつ振り分けて抽選。エージェントと縛りが1人1つずつ決まり、1人だけの振り直しもできます。' },
  { title: '配信に映す', text: 'OBSにURLを1回登録するだけ。抽選の演出が流れ、試合中は自分の縛りがミニマップの下に出続けます。' },
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
    <div>
      {/* 攻め・守りに斜めに割った帯 */}
      <section className="relative h-[460px] md:h-[560px] overflow-hidden grid grid-cols-2">
        <div className="relative overflow-hidden bg-[#ff4655] [clip-path:polygon(0_0,100%_0,86%_100%,0_100%)]">
          <div className="absolute inset-y-0 left-0 flex [mask-image:linear-gradient(to_right,#000_55%,transparent)]">
            {ATK_ART.map(src => <img key={src} src={src} alt="" className="h-full w-[120px] md:w-[170px] object-cover object-top" />)}
          </div>
        </div>
        <div className="relative overflow-hidden bg-[#1f6e92] -ml-[14%] [clip-path:polygon(14%_0,100%_0,100%_100%,0_100%)]">
          <div className="absolute inset-y-0 right-0 flex [mask-image:linear-gradient(to_left,#000_55%,transparent)]">
            {DEF_ART.map(src => <img key={src} src={src} alt="" className="h-full w-[120px] md:w-[170px] object-cover object-top" />)}
          </div>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <img src={logoImg} alt="VALORANT CHAOSガチャ" className="w-[300px] md:w-[520px] drop-shadow-[0_8px_0_rgba(0,0,0,.5)]" />
          <h1 className="mt-2 text-2xl md:text-4xl font-extrabold [text-shadow:0_3px_0_rgba(0,0,0,.6)]">カスタムを、もっとカオスに。</h1>
        </div>
      </section>

      {/* 主な2つのボタン。帯の下の境目にまたがせる */}
      <div className="relative z-10 -mt-9 flex justify-center px-4">
        <div className="flex w-full max-w-[520px]">
          <button onClick={startRoom} disabled={busy} className={`${btnPrimary} flex-1 h-[72px]`}>
            {busy ? '作成中…' : 'ルームを作る'}
          </button>
          <button onClick={() => navigate('/gacha')} className={`${btnLight} flex-1 h-[72px]`}>ひとりで回す</button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4">
        {failed && <p className="text-center text-[#ff4655] text-sm font-bold mt-4">{failed}</p>}
        <p className="mt-5 text-center text-sm text-[#9aa3ad] leading-relaxed">
          エージェントと縛りプレイをランダムに決定。ルームを作ってリンクを共有すれば、みんなの画面と配信に同じ抽選結果が出ます。<br className="hidden md:block" />
          ルームの操作は代表1人でOK。ほかの人は参加してOBSにURLを入れるだけ。ルームを短時間に作りすぎると、しばらく作れなくなります。
        </p>

        <section className="mt-14">
          <h2 className="text-2xl font-extrabold mb-4">遊び方</h2>
          <ol className="grid md:grid-cols-3 gap-2">
            {STEPS.map((step, i) => (
              <li key={step.title} className={`bg-[#1a2027] p-6 border-l-4 ${i === 0 ? 'border-[#ff4655]' : i === 1 ? 'border-[#ece8e1]' : 'border-[#3fb7ec]'}`}>
                <h3 className="text-lg font-extrabold mb-2">{step.title}</h3>
                <p className="text-sm text-[#9aa3ad] leading-relaxed">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <SubLinks />
      </div>
    </div>
  );
}
