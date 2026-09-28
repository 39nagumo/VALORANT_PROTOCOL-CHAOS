import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MAPS, mapImage } from '../data/maps';
import {
  ROOM_PATTERN, NAME_MAX, TEAM_SIZE, eventDuration, mapPool,
  type ClientMessage, type MapMode, type Member, type RoomState, type Seat, type Side,
} from '../logic/room';
import { createRoom, useRoom, useServerNow } from './connection';
import { adoptUid, getSavedName, getUid, overlayUrl, saveName } from './identity';
import { MapReveal, RarityBadge, ROLE_LABEL, SIDE_LABEL, Stage, TeamReveal } from './reveal';
import { RoleIcon } from './RoleIcon';

const SEAT_NEXT: Record<Seat, Seat> = { WATCH: 'ATK', ATK: 'DEF', DEF: 'WATCH' };
const SEAT_STYLE: Record<Seat, string> = {
  ATK: 'bg-[#FF4655]/25 text-[#ffb3ba] border-[#FF4655]/50',
  DEF: 'bg-[#46CBFF]/20 text-[#b5ecff] border-[#46CBFF]/50',
  WATCH: 'text-white/45 border-white/20',
};
const SEAT_LABEL: Record<Seat, string> = { ATK: 'ATK', DEF: 'DEF', WATCH: '観戦' };
const SHOW_REVEAL_KEY = 'chaos-gacha:page-reveal';

const btn = 'inline-flex items-center justify-center gap-2 font-black text-sm px-4 py-2 border transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const btnGhost = `${btn} border-white/20 bg-[#172129] text-white hover:bg-[#222d37]`;
const btnRed = `${btn} text-white bg-[#FF4655] border-[#FF4655] hover:bg-[#ff5e6a]`;
const btnBlue = `${btn} text-white bg-[#1d6b8a] border-[#46CBFF] hover:bg-[#237fa3]`;
const btnYellow = `${btn} text-[#2b2a3f] bg-[#ffd83b] border-[#ffd83b] hover:bg-[#ffe066]`;

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/** トップ／ガチャ画面に置く「ルームを作る」ボタン */
export function CreateRoomButton() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="mt-10 bg-[#172129]/90 border border-white/10 p-6 text-center">
      <p className="text-[#46CBFF] text-[11px] font-black tracking-[0.4em] uppercase mb-2">Room / OBS</p>
      <h3 className="text-lg font-black mb-2">みんなで同じ画面を見る・配信に映す</h3>
      <p className="text-sm text-gray-400 leading-relaxed mb-5 [word-break:auto-phrase]">
        ルームを作ってリンクを共有すると、誰かが回した結果が全員の画面とOBSに自動で出ます。
      </p>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true); setFailed(false);
          try { navigate(`/r/${await createRoom()}`); } catch { setFailed(true); } finally { setBusy(false); }
        }}
        className="bg-[#46CBFF] hover:bg-[#2fb5ea] text-[#0F1923] font-black py-3 px-10 tracking-[0.2em] text-sm disabled:opacity-50"
      >
        {busy ? '作成中…' : 'ルームを作る'}
      </button>
      {failed && <p className="text-[#FF4655] text-sm mt-3">ルームを作れませんでした。時間をおいてもう一度お試しください。</p>}
    </div>
  );
}

export function RoomPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const [uid, setUid] = useState(() => {
    // 開発中の画面確認用：?as=<ID> でその人として開く
    const as = import.meta.env.DEV ? new URLSearchParams(location.search).get('as') : null;
    if (as) adoptUid(as);
    return getUid();
  });
  const room = useRoom(ROOM_PATTERN.test(roomId) ? roomId : null, uid, 'page');

  useEffect(() => {
    if (room.movedTo) navigate(`/r/${room.movedTo}`, { replace: true });
  }, [room.movedTo, navigate]);

  if (room.closed || !ROOM_PATTERN.test(roomId)) {
    return (
      <div className="max-w-xl mx-auto text-center mt-16">
        <h2 className="text-2xl font-black mb-4">このルームは見つかりません</h2>
        <p className="text-gray-400 text-sm mb-8">終了したか、リンクが作り直された可能性があります。最新のリンクをもらってください。</p>
        <button className={btnGhost} onClick={() => navigate('/gacha')}>ガチャへ戻る</button>
      </div>
    );
  }
  if (!room.state) {
    return <div className="text-center mt-24 text-[#FF4655] font-black tracking-[0.4em] animate-pulse">CONNECTING…</div>;
  }
  if (!room.memberId) {
    return <JoinForm onJoin={name => room.act({ type: 'join', uid, name })} error={room.error}
      onAdopt={input => { if (!adoptUid(input)) return false; setUid(getUid()); return true; }} />;
  }
  return <RoomView room={room} state={room.state} uid={uid} memberId={room.memberId} />;
}

function JoinForm({ onJoin, onAdopt, error }: {
  onJoin: (name: string) => void;
  onAdopt: (input: string) => boolean;
  error: string | null;
}) {
  const [name, setName] = useState(getSavedName);
  const [code, setCode] = useState('');
  const [adoptMsg, setAdoptMsg] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    saveName(n);
    onJoin(n);
  };
  return (
    <div className="max-w-md mx-auto mt-10 bg-[#172129]/90 border border-white/10 p-8">
      <h2 className="text-xl font-black mb-2">ルームに参加</h2>
      <p className="text-sm text-gray-400 mb-6 leading-relaxed">名簿に載せる名前を入れてください。次回からは自動で入ります。</p>
      <form onSubmit={submit} className="flex gap-2">
        <input value={name} maxLength={NAME_MAX} onChange={e => setName(e.target.value)} placeholder="名前"
          className="flex-1 bg-[#0F1923] border border-gray-600 text-white px-4 py-3 font-bold outline-none focus:border-[#FF4655]" />
        <button className="bg-[#FF4655] hover:bg-[#D93645] text-white font-black px-6">参加</button>
      </form>
      {error && <p className="text-[#FF4655] text-sm mt-3">{error}</p>}
      <details className="mt-8 text-sm text-gray-400">
        <summary className="cursor-pointer hover:text-white">別のPCで使っていたOBS用URLを引き継ぐ</summary>
        <p className="mt-3 leading-relaxed">いつもと違うPCやブラウザで参加するときは、OBSに入れてあるURLを貼ってください。同じ人として扱われます。</p>
        <div className="flex gap-2 mt-3">
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="…/me/xxxxxxxx"
            className="flex-1 bg-[#0F1923] border border-gray-600 text-white px-3 py-2 outline-none" />
          <button className={btnGhost} onClick={() => setAdoptMsg(onAdopt(code) ? '引き継ぎました' : 'URLの形が正しくありません')}>引き継ぐ</button>
        </div>
        {adoptMsg && <p className="mt-2">{adoptMsg}</p>}
      </details>
    </div>
  );
}

type Room = ReturnType<typeof useRoom>;
type Act = (m: ClientMessage) => void;
type StepKey = 'gather' | 'atk' | 'def' | 'map' | 'start' | 'playing';

const STEPS: { key: Exclude<StepKey, 'playing'>; label: string }[] = [
  { key: 'gather', label: '10人そろえる' },
  { key: 'atk', label: 'ATTACKER' },
  { key: 'def', label: 'DEFENDER' },
  { key: 'map', label: 'マップ' },
  { key: 'start', label: '試合開始' },
];

/** 今どこまで進んでいるか（上から順に、まだ終わっていない最初のもの） */
function currentStep(s: RoomState): StepKey {
  const n = (seat: Seat) => s.members.filter(m => m.seat === seat).length;
  if (n('ATK') !== TEAM_SIZE || n('DEF') !== TEAM_SIZE) return 'gather';
  if (!s.teams.ATK) return 'atk';
  if (!s.teams.DEF) return 'def';
  if (!s.map) return 'map';
  if (s.display) return 'start';
  return 'playing';
}

function RoomView({ room, state, uid, memberId }: { room: Room; state: RoomState; uid: string; memberId: string }) {
  const act: Act = m => room.act(m);
  const now = useServerNow(room.offset, Date.now() + room.offset.current < state.lockUntil + 800);
  const locked = now < state.lockUntil;
  const [toast, setToast] = useState<string | null>(null);
  const [peek, setPeek] = useState(false);
  const [showReveal, setShowReveal] = useState(() => {
    try { return localStorage.getItem(SHOW_REVEAL_KEY) !== 'off'; } catch { return true; }
  });
  const [closedEvent, setClosedEvent] = useState<string | null>(null);
  const me = state.members.find(m => m.id === memberId);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const copyToast = async (text: string, label: string) => setToast((await copy(text)) ? `${label}をコピーしました` : 'コピーできませんでした');

  const e = state.event;
  const active = e && e.id !== room.skipEventId && now < e.startedAt + eventDuration(e) ? e : null;
  // この画面では演出の間だけ大きく見せる（OBSは閉じるまで出し続ける）
  const modal = showReveal && active && active.kind !== 'reroll' && closedEvent !== active.id ? active : null;
  const step = currentStep(state);

  return (
    <div className="w-full">
      {/* 上の帯：URLは画面に出さない（配信に映ってもいいように） */}
      <div className="flex flex-wrap items-center gap-3 mb-3 bg-[#172129]/90 border border-white/10 px-4 py-2">
        <span className="text-xs font-black tracking-[0.3em] text-gray-400">ROOM</span>
        <span className={`w-2.5 h-2.5 rounded-full ${room.status === 'open' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}
          title={room.status === 'open' ? '接続中' : '再接続中'} />
        <button className={btnGhost} onClick={() => copyToast(location.href, '招待リンク')}>招待リンクをコピー</button>
        <button className="text-xs text-gray-500 hover:text-white underline" onClick={() => {
          if (confirm('リンクを作り直しますか？\n今のリンクは使えなくなります（名簿と結果はそのまま引き継ぎます）。')) act({ type: 'regenerate' });
        }}>リンクを作り直す</button>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
          <span className="text-gray-400">あなた：<b className="text-white text-base">{me?.name}</b></span>
          <button className="text-gray-500 text-xs underline hover:text-white" onClick={() => {
            const n = prompt('新しい名前', me?.name ?? '')?.trim();
            if (n) { saveName(n); act({ type: 'join', uid, name: n }); }
          }}>名前を変更</button>
          <span className="text-gray-400">OBS用URL</span>
          <code className="bg-black/40 px-2 py-1 text-xs select-none">{peek ? overlayUrl(uid) : `…/me/${'●'.repeat(8)}`}</code>
          <button className={btnGhost} onClick={() => copyToast(overlayUrl(uid), 'OBS用URL')}>コピー</button>
          <button className="text-gray-500 text-xs hover:text-white" onPointerDown={() => setPeek(true)}
            onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)}>押している間表示</button>
          <details className="relative text-xs text-gray-400">
            <summary className="cursor-pointer hover:text-white list-none underline">OBSの設定方法</summary>
            <div className="absolute right-0 top-6 z-50 w-[420px] bg-[#0F1923] border border-white/15 p-4 shadow-2xl text-sm leading-relaxed">
              <ol className="list-decimal ml-5 space-y-1">
                <li>「コピー」でOBS用URLをコピーします。</li>
                <li>OBSで「ソース」→「＋」→「ブラウザ」を追加し、URLに貼り付けます。幅 1920・高さ 1080。</li>
                <li>ゲーム画面より上、V体より下に置いて、画面全体に広げます。</li>
                <li>次回からは、新しいルームで「参加」を押すだけでOBSも切り替わります。</li>
              </ol>
              <p className="mt-2 text-gray-500">カードの位置は URL の末尾に <code>?x=24&amp;y=410&amp;s=1</code>（横・縦・大きさ）で調整できます。</p>
            </div>
          </details>
        </div>
      </div>

      <Guide step={step} state={state} locked={locked} act={act} />

      {/* 抽選中のお知らせは、ロゴ横の空いている所に重ねて出す（下の表示がずれないように） */}
      {locked && e && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[150] px-5 py-2 rounded-full bg-[#FF4655] text-white text-sm font-black shadow-[0_6px_20px_rgba(0,0,0,.5)] animate-pulse whitespace-nowrap">
          {e.by}さんが{e.kind === 'map' ? 'マップ' : e.kind === 'team' ? SIDE_LABEL[e.side] : '振り直し'}を抽選中…
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[240px_1fr_1fr] 2xl:grid-cols-[240px_1fr_1fr_340px]">
        <Roster members={state.members} memberId={memberId} act={act} focus={step === 'gather'} />
        {(['ATK', 'DEF'] as Side[]).map(side => (
          <TeamPanel key={side} side={side} state={state} locked={locked} act={act}
            focus={step === (side === 'ATK' ? 'atk' : 'def')}
            rerolling={active?.kind === 'reroll' && active.side === side ? active.index : null} />
        ))}
        <div className="lg:col-span-3 2xl:col-span-1">
          <MapPanel state={state} locked={locked} act={act} focus={step === 'map'} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-4">
        <button className={btnGhost} onClick={() => {
          if (confirm('新しい試合を始めますか？\n全員の抽選結果とOBSの表示が消えます（チーム分けは残ります）。')) act({ type: 'newMatch' });
        }}>新しい試合（結果をリセット）</button>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input type="checkbox" checked={showReveal} onChange={ev => {
            setShowReveal(ev.target.checked);
            try { localStorage.setItem(SHOW_REVEAL_KEY, ev.target.checked ? 'on' : 'off'); } catch { /* 保存できない環境 */ }
          }} />
          この画面でも抽選の演出を見る
        </label>
      </div>

      {(room.error || toast) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 font-bold text-sm shadow-2xl border bg-[#0F1923] border-white/20">
          {room.error ?? toast}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-4">
          <div className="relative w-full max-w-[1600px] aspect-video">
            <Stage>
              {modal.kind === 'team' && state.teams[modal.side] && <TeamReveal roll={state.teams[modal.side]!} event={modal} t={now - modal.startedAt} meId={memberId} />}
              {modal.kind === 'map' && <MapReveal event={modal} t={now - modal.startedAt} />}
            </Stage>
            <button className="absolute -top-10 right-0 text-white/70 hover:text-white text-sm font-bold"
              onClick={() => setClosedEvent(modal.id)}>✕ 閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 「次にやること」の案内。進み具合の目盛りと、その場で押せるボタン */
function Guide({ step, state, locked, act }: { step: StepKey; state: RoomState; locked: boolean; act: Act }) {
  const n = (seat: Seat) => state.members.filter(m => m.seat === seat).length;
  const doneIndex = step === 'playing' ? STEPS.length : STEPS.findIndex(s => s.key === step);
  const pool = mapPool(MAPS.map(m => m.id), state).length;

  let text: ReactNode;
  let action: ReactNode = null;
  switch (step) {
    case 'gather':
      text = n('ATK') > TEAM_SIZE || n('DEF') > TEAM_SIZE
        ? <><b className="text-amber-300">{n('ATK') > TEAM_SIZE ? `ATKが${n('ATK')}人` : ''}{n('ATK') > TEAM_SIZE && n('DEF') > TEAM_SIZE ? '・' : ''}{n('DEF') > TEAM_SIZE ? `DEFが${n('DEF')}人` : ''}</b> います。5人ずつにしてください（今 ATK {n('ATK')}/5・DEF {n('DEF')}/5）。</>
        : <>左の名簿で <b>ATK と DEF に5人ずつ</b> 振り分けましょう（今 ATK {n('ATK')}/5・DEF {n('DEF')}/5）。</>;
      action = <button className={btnGhost} onClick={() => act({ type: 'randomTeams' })}>ランダムでチーム分け</button>;
      break;
    case 'atk':
      text = <>10人そろいました！まずは <b className="text-[#FF4655]">ATTACKER</b> を回しましょう。</>;
      action = <button className={`${btnRed} text-base px-6`} disabled={locked} onClick={() => act({ type: 'roll', side: 'ATK' })}>ATTACKERを回す</button>;
      break;
    case 'def':
      text = <>ATTACKERの結果を確認。気になる人は <b>顔↻・縛↻</b> で1人ずつ振り直せます。OKなら <b className="text-[#46CBFF]">DEFENDER</b> へ。</>;
      action = <button className={`${btnBlue} text-base px-6`} disabled={locked} onClick={() => act({ type: 'roll', side: 'DEF' })}>DEFENDERを回す</button>;
      break;
    case 'map':
      if (state.display?.kind !== 'mapSetup') {
        text = <>DEFENDERも確認できたら、<b className="text-[#ffd83b]">マップ候補</b> をOBSに出してみんなで決めましょう。</>;
        action = <button className={`${btnYellow} text-base px-6`} disabled={locked} onClick={() => act({ type: 'showMapSetup' })}>マップ候補をOBSに出す</button>;
      } else {
        text = <>右の一覧で <b>PICK / BAN</b> すると、全員のOBSにそのまま映ります。決まったら回しましょう。</>;
        action = <button className={`${btnYellow} text-base px-6`} disabled={locked || pool === 0} onClick={() => act({ type: 'mapRoll' })}>マップを回す（{pool}）</button>;
      }
      break;
    case 'start':
      text = <>全部決まりました！OBSの結果画面を閉じると、各自のミニマップの下に縛りが出て <b>試合開始</b> です。</>;
      action = <button className={`${btnYellow} text-base px-6`} onClick={() => act({ type: 'closeDisplay' })}>結果画面を閉じて試合開始</button>;
      break;
    case 'playing':
      text = <>試合中です。終わったら「新しい試合」で次へ（チーム分けは残ります）。</>;
      action = <button className={btnGhost} onClick={() => {
        if (confirm('新しい試合を始めますか？\n全員の抽選結果とOBSの表示が消えます（チーム分けは残ります）。')) act({ type: 'newMatch' });
      }}>新しい試合</button>;
      break;
  }

  return (
    <div className="mb-3 bg-[#172129]/90 border border-[#ffd83b]/40 px-4 py-3">
      <ol className="flex flex-wrap items-center gap-2 mb-2">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${
              i < doneIndex ? 'border-emerald-400/50 text-emerald-300 bg-emerald-400/10'
                : i === doneIndex ? 'border-[#ffd83b] text-[#2b2a3f] bg-[#ffd83b]'
                : 'border-white/15 text-white/40'}`}>
              {i < doneIndex ? '✓' : i + 1} {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="text-white/20">›</span>}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[#ffd83b] font-black text-sm">▶ 次にやること</span>
        <span className="text-sm leading-relaxed flex-1 min-w-[280px]">{text}</span>
        {action}
        {state.display && step !== 'start' && (
          <button className="text-xs text-gray-400 hover:text-white underline" onClick={() => act({ type: 'closeDisplay' })}>OBSの結果画面を閉じる</button>
        )}
      </div>
    </div>
  );
}

const panel = (focus: boolean) =>
  `bg-[#172129]/90 border p-3 flex flex-col ${focus ? 'border-[#ffd83b]/70 shadow-[0_0_0_1px_rgba(255,216,59,.35)]' : 'border-white/10'}`;

function Roster({ members, memberId, act, focus }: { members: Member[]; memberId: string; act: Act; focus: boolean }) {
  const count = (seat: Seat) => members.filter(m => m.seat === seat).length;
  return (
    <section className={panel(focus)}>
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-black tracking-wider">参加者 {members.length}人</h3>
        <span className="text-[11px] text-gray-500">● OBS起動中</span>
      </div>
      <p className="text-[11px] text-gray-500 mb-2">右のボタンで ATK → DEF → 観戦</p>
      <ul className="overflow-y-auto max-h-[420px] pr-1">
        {members.map(m => (
          <li key={m.id} className={`flex items-center gap-2 py-1.5 border-b border-white/5 text-sm ${m.seat === 'WATCH' ? 'text-white/50' : ''}`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${m.online ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-white/15'}`} />
            <span className="truncate font-bold">{m.name}{m.id === memberId && <span className="text-[11px] text-gray-500 font-normal ml-1">（あなた）</span>}</span>
            <button onClick={() => act({ type: 'seat', memberId: m.id, seat: SEAT_NEXT[m.seat] })}
              className={`ml-auto shrink-0 w-12 text-[11px] font-black py-0.5 border ${SEAT_STYLE[m.seat]}`}>{SEAT_LABEL[m.seat]}</button>
          </li>
        ))}
      </ul>
      <div className="text-[11px] text-gray-500 mt-2">
        <span className={count('ATK') > TEAM_SIZE ? 'text-amber-300 font-bold' : ''}>ATK {count('ATK')}/{TEAM_SIZE}</span>・
        <span className={count('DEF') > TEAM_SIZE ? 'text-amber-300 font-bold' : ''}>DEF {count('DEF')}/{TEAM_SIZE}</span>
      </div>
      <button className={`${btnGhost} w-full mt-2`} onClick={() => act({ type: 'randomTeams' })}>ランダムでチーム分け</button>
    </section>
  );
}

function TeamPanel({ side, state, locked, act, rerolling, focus }: {
  side: Side; state: RoomState; locked: boolean; act: Act; rerolling: number | null; focus: boolean;
}) {
  const roll = state.teams[side];
  const seated = state.members.filter(m => m.seat === side);
  const color = side === 'ATK' ? 'text-[#FF4655]' : 'text-[#46CBFF]';
  const changed = roll && (roll.slots.length !== seated.length || roll.slots.some(s => !seated.some(m => m.id === s.memberId)));

  return (
    <section className={panel(focus)}>
      <div className="flex items-center justify-between mb-2">
        <h3 className={`font-black text-lg italic tracking-wider ${color}`}>{SIDE_LABEL[side]}</h3>
        <button disabled={locked || seated.length !== TEAM_SIZE} onClick={() => act({ type: 'roll', side })}
          className={`${side === 'ATK' ? btnRed : btnBlue} py-1.5`}>
          {roll ? '回し直す' : '回す'}
        </button>
      </div>
      {roll ? (
        <ul className="space-y-1.5">
          {roll.slots.map((s, i) => (
            <li key={s.memberId} className={`flex gap-2 bg-black/30 border border-white/5 p-1.5 ${rerolling === i ? 'animate-pulse' : ''}`}>
              <img src={s.agent.image} alt="" className="w-12 h-12 object-cover object-top shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-sm truncate">{s.name}</span>
                  <span className="text-[11px] text-gray-400 truncate inline-flex items-center gap-1">
                    <RoleIcon role={s.agent.role} size={12} />{s.agent.name}・{ROLE_LABEL[s.agent.role]}
                  </span>
                </div>
                <div className="flex items-start gap-1.5 mt-0.5">
                  <RarityBadge rarity={s.bind.rarity} size="sm" />
                  <span className="text-[11px] text-white/80 leading-snug line-clamp-2">{s.bind.text.replace(/\n/g, ' ')}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button disabled={locked} title="エージェントを振り直す" onClick={() => act({ type: 'reroll', side, index: i, target: 'agent' })}
                  className="text-[10px] px-1.5 py-0.5 border border-white/15 text-white/60 hover:text-white disabled:opacity-30">顔↻</button>
                <button disabled={locked} title="縛りを振り直す" onClick={() => act({ type: 'reroll', side, index: i, target: 'bind' })}
                  className="text-[10px] px-1.5 py-0.5 border border-white/15 text-white/60 hover:text-white disabled:opacity-30">縛↻</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="border border-dashed border-white/15 p-3 flex-1">
          {seated.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {seated.map(m => <li key={m.id} className="px-2.5 py-1 bg-white/10 text-white font-bold text-sm">{m.name}</li>)}
            </ul>
          ) : <span className="text-sm text-gray-400">左の名簿でメンバーを振り分けてください</span>}
          <div className="mt-2 text-xs text-gray-400">{seated.length}/{TEAM_SIZE}人・未抽選</div>
        </div>
      )}
      {seated.length > TEAM_SIZE && <p className="text-xs text-amber-300 mt-2">{seated.length}人います。5人にすると回せます。</p>}
      {changed && seated.length <= TEAM_SIZE && <p className="text-xs text-amber-300 mt-2">メンバーが変わっています。回し直すと反映されます。</p>}
    </section>
  );
}

function MapPanel({ state, locked, act, focus }: { state: RoomState; locked: boolean; act: Act; focus: boolean }) {
  const mode: MapMode = state.mapMode ?? 'BAN';
  const marks = state.mapMarks ?? [];
  const pool = mapPool(MAPS.map(m => m.id), state);
  // いきなり回すとOBS側の準備が追いつかないので、先に候補をOBSに出してから回す
  const ready = state.display?.kind === 'mapSetup' || state.display?.kind === 'map';
  return (
    <section className={`${panel(focus)} h-full`}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h3 className="font-black text-lg italic tracking-wider text-[#ffd83b]">MAP</h3>
        <div className="flex bg-black/40 p-0.5 border border-white/10">
          {(['PICK', 'BAN'] as MapMode[]).map(m => (
            <button key={m} onClick={() => act({ type: 'mapMode', mode: m })}
              className={`px-3 py-0.5 text-[11px] font-black tracking-widest ${mode === m ? (m === 'PICK' ? 'bg-[#FF4655] text-white' : 'bg-[#46CBFF] text-[#0F1923]') : 'text-white/40 hover:text-white'}`}>{m}</button>
          ))}
        </div>
        <button disabled={locked || state.display?.kind === 'mapSetup'} onClick={() => act({ type: 'showMapSetup' })}
          className={`${btnGhost} ml-auto py-1 px-2 text-xs whitespace-nowrap`}>OBSに出す</button>
        <button disabled={locked || pool.length === 0 || !ready} onClick={() => act({ type: 'mapRoll' })}
          title={ready ? '' : '先に「OBSに出す」を押してください'}
          className={`${btnYellow} py-1 px-3 whitespace-nowrap`}>回す（{pool.length}）</button>
      </div>
      <p className="text-[11px] text-gray-500 mb-2">
        {!ready && <b className="text-[#ffd83b]">先に「OBSに出す」を押してください。</b>}
        {mode === 'PICK' ? '押したマップの中から選びます。' : '押したマップを除いて選びます。'}一度出たマップは次から外れます。
      </p>
      <div className="grid grid-cols-5 2xl:grid-cols-3 gap-1.5">
        {MAPS.map(m => {
          const marked = marks.includes(m.id);
          const used = state.mapHistory.includes(m.id);
          const current = state.map === m.id;
          const out = (mode === 'BAN' && marked) || (mode === 'PICK' && !marked) || (used && !current);
          return (
            <button key={m.id} onClick={() => act({ type: 'mapMark', mapId: m.id })}
              className={`relative aspect-video overflow-hidden border-2 ${current ? 'border-[#ffd83b]' : mode === 'PICK' && marked ? 'border-[#FF4655]' : 'border-white/10'}`}>
              <img src={mapImage(m)} alt="" className={`absolute inset-0 w-full h-full object-cover ${out ? 'grayscale opacity-30' : ''}`} />
              <span className="absolute inset-x-0 bottom-0 text-[10px] font-black tracking-wider bg-black/60">{m.name}</span>
              {(current || used || marked) && (
                <span className={`absolute top-0.5 left-0.5 text-[9px] font-black px-1 ${
                  current ? 'bg-[#ffd83b] text-[#2b2a3f]' : marked ? (mode === 'PICK' ? 'bg-[#FF4655]' : 'bg-gray-700') : 'bg-black/70'}`}>
                  {current ? '今回' : marked ? mode : '済'}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button className="text-[11px] text-gray-500 hover:text-white underline mt-2 self-start disabled:opacity-40"
        disabled={!state.mapHistory.length} onClick={() => act({ type: 'mapClearHistory' })}>出たマップを戻す</button>
    </section>
  );
}
