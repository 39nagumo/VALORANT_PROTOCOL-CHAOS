import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MAPS, mapImage } from '../data/maps';
import {
  ROOM_PATTERN, NAME_MAX, TEAM_SIZE, eventDuration,
  type ClientMessage, type Member, type RoomState, type Seat, type Side,
} from '../logic/room';
import { createRoom, useRoom, useServerNow } from './connection';
import { adoptUid, getSavedName, getUid, overlayUrl, saveName } from './identity';
import { MapReveal, RarityBadge, ROLE_LABEL, SIDE_LABEL, Stage, TeamReveal } from './reveal';

const SEAT_NEXT: Record<Seat, Seat> = { WATCH: 'ATK', ATK: 'DEF', DEF: 'WATCH' };
const SEAT_STYLE: Record<Seat, string> = {
  ATK: 'bg-[#FF4655]/25 text-[#ffb3ba] border-[#FF4655]/40',
  DEF: 'bg-[#46CBFF]/20 text-[#b5ecff] border-[#46CBFF]/40',
  WATCH: 'text-white/45 border-white/20',
};
const SEAT_LABEL: Record<Seat, string> = { ATK: 'ATK', DEF: 'DEF', WATCH: '観戦' };
const SHOW_REVEAL_KEY = 'chaos-gacha:page-reveal';

const btn = 'inline-flex items-center justify-center gap-2 font-black text-sm px-4 py-2 border transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const btnGhost = `${btn} border-white/20 bg-[#172129] text-white hover:bg-[#222d37]`;

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

function RoomView({ room, state, uid, memberId }: { room: Room; state: RoomState; uid: string; memberId: string }) {
  const act = (m: ClientMessage) => room.act(m);
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
  const display = state.display ?? null;

  return (
    <div className="max-w-[1400px] mx-auto w-full">
      {/* 上の帯：URLは画面に出さない（配信に映ってもいいように） */}
      <div className="flex flex-wrap items-center gap-3 mb-4 bg-[#172129]/90 border border-white/10 px-4 py-3">
        <span className="text-xs font-black tracking-[0.3em] text-gray-400">ROOM</span>
        <span className={`w-2.5 h-2.5 rounded-full ${room.status === 'open' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}
          title={room.status === 'open' ? '接続中' : '再接続中'} />
        <button className={btnGhost} onClick={() => copyToast(location.href, '招待リンク')}>招待リンクをコピー</button>
        <button className={`${btnGhost} text-white/60`} onClick={() => {
          if (confirm('リンクを作り直しますか？\n今のリンクは使えなくなります（名簿と結果はそのまま引き継ぎます）。')) act({ type: 'regenerate' });
        }}>リンクを作り直す</button>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
          <span className="text-gray-400">あなた：<b className="text-white text-base">{me?.name}</b></span>
          <button className="text-gray-400 underline hover:text-white" onClick={() => {
            const n = prompt('新しい名前', me?.name ?? '')?.trim();
            if (n) { saveName(n); act({ type: 'join', uid, name: n }); }
          }}>名前を変更</button>
          <span className="text-gray-400">OBS用URL：</span>
          <code className="bg-black/40 px-2 py-1 text-xs select-none">{peek ? overlayUrl(uid) : `…/me/${'●'.repeat(8)}`}</code>
          <button className={btnGhost} onClick={() => copyToast(overlayUrl(uid), 'OBS用URL')}>コピー</button>
          <button className="text-gray-500 text-xs hover:text-white" onPointerDown={() => setPeek(true)}
            onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)}>押している間表示</button>
        </div>
      </div>

      <details className="mb-4 text-sm text-gray-400 bg-[#172129]/60 border border-white/5 px-4 py-2">
        <summary className="cursor-pointer hover:text-white">OBSの設定方法（最初の1回だけ）</summary>
        <ol className="list-decimal ml-6 mt-2 space-y-1 leading-relaxed">
          <li>上の「コピー」でOBS用URLをコピーします。</li>
          <li>OBSで「ソース」→「＋」→「ブラウザ」を追加し、URLに貼り付けます。幅 1920・高さ 1080 にします。</li>
          <li>ゲーム画面より上、V体より下に置きます。画面全体に広げておけば、自分の縛りはミニマップの下に出ます。</li>
          <li>次回からは、新しいルームのリンクを開いて「参加」を押すだけで、OBSも自動で切り替わります。</li>
        </ol>
        <p className="mt-2 leading-relaxed">カードの位置を変えたいときは、URLの末尾に <code>?x=24&amp;y=410&amp;s=1</code>（横位置・縦位置・大きさ）を付けて調整できます。</p>
      </details>

      {locked && e && (
        <div className="mb-4 px-4 py-2 bg-[#FF4655]/15 border border-[#FF4655]/40 text-sm font-bold animate-pulse">
          {e.by}さんが{e.kind === 'map' ? 'マップ' : e.kind === 'team' ? SIDE_LABEL[e.side] : '振り直し'}を抽選中…（終わるまで回せません）
        </div>
      )}

      {display && (
        <div className="mb-4 flex flex-wrap items-center gap-3 px-4 py-3 bg-[#46CBFF]/10 border border-[#46CBFF]/40">
          <span className="text-sm font-bold">
            OBSに{display.kind === 'map' ? 'マップ' : SIDE_LABEL[display.side]}の抽選結果を表示中です。振り直しもこのままできます。
          </span>
          <button className={`${btn} ml-auto bg-[#46CBFF] border-[#46CBFF] text-[#0F1923] hover:bg-[#2fb5ea]`}
            onClick={() => act({ type: 'closeDisplay' })}>OBSの結果画面を閉じる</button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr_1fr]">
        <Roster members={state.members} memberId={memberId} act={act} />
        {(['ATK', 'DEF'] as Side[]).map(side => (
          <TeamPanel key={side} side={side} state={state} locked={locked} act={act}
            rerolling={active?.kind === 'reroll' && active.side === side ? active.index : null} />
        ))}
      </div>

      <MapPanel state={state} locked={locked} act={act} />

      <div className="flex flex-wrap items-center gap-4 mt-6 mb-4">
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
              {modal.kind === 'team' && state.teams[modal.side] && <TeamReveal roll={state.teams[modal.side]!} event={modal} t={now - modal.startedAt} />}
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

function Roster({ members, memberId, act }: { members: Member[]; memberId: string; act: (m: ClientMessage) => void }) {
  const count = (seat: Seat) => members.filter(m => m.seat === seat).length;
  return (
    <section className="bg-[#172129]/90 border border-white/10 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-black tracking-wider">参加者 {members.length}人</h3>
        <span className="text-xs text-gray-500">● = OBS起動中</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">右のボタンを押すと ATK → DEF → 観戦 と切り替わります</p>
      <ul>
        {members.map(m => (
          <li key={m.id} className={`flex items-center gap-3 py-2 border-b border-white/5 ${m.seat === 'WATCH' ? 'text-white/50' : ''}`}>
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${m.online ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-white/15'}`} />
            <span className="truncate font-bold">{m.name}{m.id === memberId && <span className="text-xs text-gray-500 font-normal ml-1">（あなた）</span>}</span>
            <button onClick={() => act({ type: 'seat', memberId: m.id, seat: SEAT_NEXT[m.seat] })}
              className={`ml-auto shrink-0 w-14 text-xs font-black py-1 border ${SEAT_STYLE[m.seat]}`}>{SEAT_LABEL[m.seat]}</button>
          </li>
        ))}
      </ul>
      <div className="text-xs text-gray-500 mt-3">ATK {count('ATK')}/{TEAM_SIZE}・DEF {count('DEF')}/{TEAM_SIZE}</div>
      <button className={`${btnGhost} w-full mt-3`} onClick={() => act({ type: 'randomTeams' })}>ランダムでチーム分け</button>
    </section>
  );
}

function TeamPanel({ side, state, locked, act, rerolling }: {
  side: Side; state: RoomState; locked: boolean; act: (m: ClientMessage) => void; rerolling: number | null;
}) {
  const roll = state.teams[side];
  const seated = state.members.filter(m => m.seat === side);
  const color = side === 'ATK' ? 'text-[#FF4655]' : 'text-[#46CBFF]';
  const changed = roll && (roll.slots.length !== seated.length || roll.slots.some(s => !seated.some(m => m.id === s.memberId)));

  return (
    <section className="bg-[#172129]/90 border border-white/10 p-4 flex flex-col">
      <h3 className={`font-black text-xl italic tracking-wider mb-3 ${color}`}>{SIDE_LABEL[side]}</h3>
      {roll ? (
        <ul className="space-y-2">
          {roll.slots.map((s, i) => (
            <li key={s.memberId} className={`flex gap-3 bg-black/30 border border-white/5 p-2 ${rerolling === i ? 'animate-pulse' : ''}`}>
              <img src={s.agent.image} alt="" className="w-16 h-16 object-cover object-top shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold truncate">{s.name}</span>
                  <span className="text-xs text-gray-400 truncate">{s.agent.name}・{ROLE_LABEL[s.agent.role]}</span>
                </div>
                <div className="flex items-start gap-2 mt-1">
                  <RarityBadge rarity={s.bind.rarity} size="sm" />
                  <span className="text-xs text-white/80 leading-snug whitespace-pre-line">{s.bind.text}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button disabled={locked} title="エージェントを振り直す" onClick={() => act({ type: 'reroll', side, index: i, target: 'agent' })}
                  className="text-[11px] px-2 py-1 border border-white/15 text-white/60 hover:text-white disabled:opacity-30">顔↻</button>
                <button disabled={locked} title="縛りを振り直す" onClick={() => act({ type: 'reroll', side, index: i, target: 'bind' })}
                  className="text-[11px] px-2 py-1 border border-white/15 text-white/60 hover:text-white disabled:opacity-30">縛↻</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="border border-dashed border-white/10 p-4 text-sm text-gray-500 min-h-[120px]">
          {seated.length ? seated.map(m => m.name).join(' / ') : '左の名簿でメンバーを振り分けてください'}
          <div className="mt-2 text-xs">{seated.length}/{TEAM_SIZE}人・未抽選</div>
        </div>
      )}
      {changed && <p className="text-xs text-amber-300 mt-2">メンバーが変わっています。回し直すと反映されます。</p>}
      <button disabled={locked || seated.length !== TEAM_SIZE} onClick={() => act({ type: 'roll', side })}
        className={`${btn} mt-4 py-3 text-base text-white ${side === 'ATK' ? 'bg-[#FF4655] border-[#FF4655] hover:bg-[#ff5e6a]' : 'bg-[#1d6b8a] border-[#46CBFF] hover:bg-[#237fa3]'}`}>
        {SIDE_LABEL[side]}を{roll ? '回し直す' : '回す'}
      </button>
    </section>
  );
}

function MapPanel({ state, locked, act }: { state: RoomState; locked: boolean; act: (m: ClientMessage) => void }) {
  const pool = MAPS.filter(m => !state.mapBans.includes(m.id) && !state.mapHistory.includes(m.id));
  return (
    <section className="mt-4 bg-[#172129]/90 border border-white/10 p-4">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <h3 className="font-black text-xl italic tracking-wider">MAP</h3>
        <span className="text-xs text-gray-500">押すと除外／もう一度押すと戻す。一度出たマップは次から外れます。</span>
        <div className="ml-auto flex gap-2">
          <button className={btnGhost} disabled={!state.mapHistory.length} onClick={() => act({ type: 'mapClearHistory' })}>出たマップを戻す</button>
          <button disabled={locked || pool.length === 0} onClick={() => act({ type: 'mapRoll' })}
            className={`${btn} text-white bg-[#FF4655] border-[#FF4655] hover:bg-[#ff5e6a]`}>マップを回す（{pool.length}）</button>
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-2">
        {MAPS.map(m => {
          const banned = state.mapBans.includes(m.id);
          const used = state.mapHistory.includes(m.id);
          const current = state.map === m.id;
          return (
            <button key={m.id} onClick={() => act({ type: 'mapBan', mapId: m.id })}
              className={`relative aspect-video overflow-hidden border-2 ${current ? 'border-[#FF4655]' : 'border-white/10'}`}>
              <img src={mapImage(m)} alt="" className={`absolute inset-0 w-full h-full object-cover ${banned || (used && !current) ? 'grayscale opacity-30' : ''}`} />
              <span className="absolute inset-x-0 bottom-0 text-[11px] font-black tracking-wider bg-black/60 py-0.5">{m.name}</span>
              {(banned || used || current) && (
                <span className={`absolute top-1 left-1 text-[10px] font-black px-1.5 ${current ? 'bg-[#FF4655]' : banned ? 'bg-gray-700' : 'bg-black/70'}`}>
                  {current ? '今回' : banned ? '除外' : '済'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
