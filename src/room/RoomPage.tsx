import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MAPS, mapImage } from '../data/maps';
import {
  ROOM_PATTERN, NAME_MAX, TEAM_SIZE, TEAM_SHUFFLE_MS, eventDuration, mapPool,
  RANKS, UNRANKED_POINTS, rankOf, teamPoints, isRankId, BIND_RARITIES, isBindRarity,
  type ClientMessage, type MapMode, type Member, type RankId, type RoomState, type Seat, type Side,
} from '../logic/room';
import { addDummyMembers, createRoom, useRoom, useServerNow } from './connection';
import { adoptUid, getSavedName, getSavedRank, getUid, overlayUrl, saveName, saveRank } from './identity';
import { MapReveal, RARITY_COLOR, SIDE_LABEL, Stage, TeamReveal } from './reveal';
import { RoleIcon } from './RoleIcon';
import { HowToModal } from './HowToModal';
import type { BindRarity } from '../logic/gacha';
import { RankChip } from './RankChip';

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
  const [failed, setFailed] = useState<string | null>(null);
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
          setBusy(true); setFailed(null);
          try { navigate(`/r/${await createRoom()}`, { state: { howto: true } }); } catch (e) { setFailed((e as Error).message); } finally { setBusy(false); }
        }}
        className="bg-[#46CBFF] hover:bg-[#2fb5ea] text-[#0F1923] font-black py-3 px-10 tracking-[0.2em] text-sm disabled:opacity-50"
      >
        {busy ? '作成中…' : 'ルームを作る'}
      </button>
      {failed && <p className="text-[#FF4655] text-sm mt-3">{failed}</p>}
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
  const loc = useLocation();
  // 「ルームを作る」から来たときだけ、使い方の窓を1回出す（再読み込みでは出さない）
  const fromCreate = (loc.state as { howto?: boolean } | null)?.howto === true;
  const [howto, setHowto] = useState<null | 'created' | 'again'>(() => (fromCreate ? 'created' : null));
  useEffect(() => {
    if (fromCreate) navigate(loc.pathname, { replace: true, state: null });
  }, [fromCreate, loc.pathname, navigate]);
  const howtoModal = howto && <HowToModal created={howto === 'created'} onClose={() => setHowto(null)} />;

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
    return <>{howtoModal}<div className="text-center mt-24 text-[#FF4655] font-black tracking-[0.4em] animate-pulse">CONNECTING…</div></>;
  }
  if (!room.memberId) {
    return <>{howtoModal}<JoinForm onJoin={(name, rank) => room.act({ type: 'join', uid, name, rank })} error={room.error}
      onHowTo={() => setHowto('again')}
      onAdopt={input => { if (!adoptUid(input)) return false; setUid(getUid()); return true; }} /></>;
  }
  return <>{howtoModal}<RoomView room={room} state={room.state} uid={uid} memberId={room.memberId} /></>;
}

/** 最高ランクを選ぶ（段だけ。ダイヤ1〜3のような細かい区分は無し） */
function RankSelect({ value, onChange, compact = false }: { value: RankId | null; onChange: (r: RankId | null) => void; compact?: boolean }) {
  return (
    <select value={value ?? ''} onChange={e => onChange(isRankId(e.target.value) ? e.target.value : null)}
      style={{ color: rankOf(value)?.fg ?? '#ffffff' }}
      className={`bg-[#0F1923] border border-gray-600 font-black outline-none focus:border-[#FF4655] ${compact ? 'px-2 py-1 text-xs' : 'w-full px-4 py-3'}`}>
      <option value="" style={{ background: '#0F1923', color: '#ffffff' }}>未設定</option>
      {RANKS.map(r => <option key={r.id} value={r.id} style={{ background: '#0F1923', color: r.fg }}>{r.label}</option>)}
    </select>
  );
}

/** 縛りのレア度を選ぶ（なし／CHAOS／…） */
function RaritySelect({ value, onChange }: { value: BindRarity | null; onChange: (r: BindRarity | null) => void }) {
  return (
    <select value={value ?? ''} onChange={e => onChange(isBindRarity(e.target.value) ? e.target.value : null)}
      // 11/17 本人：選んだ後も、開いた一覧でも、レア度の色の文字で
      style={{ color: value ? RARITY_COLOR[value] : '#ffffff' }}
      className="flex-1 min-w-0 bg-[#0F1923] border border-gray-600 font-bold px-2 py-1 outline-none focus:border-[#FF4655]">
      <option value="" style={{ color: '#ffffff' }}>なし</option>
      {BIND_RARITIES.map(r => <option key={r} value={r} style={{ color: RARITY_COLOR[r] }}>{r}</option>)}
    </select>
  );
}

function JoinForm({ onJoin, onAdopt, onHowTo, error }: {
  onJoin: (name: string, rank: RankId | null) => void;
  onHowTo: () => void;
  onAdopt: (input: string) => boolean;
  error: string | null;
}) {
  const [name, setName] = useState(getSavedName);
  const [rank, setRank] = useState<RankId | null>(getSavedRank);
  const [code, setCode] = useState('');
  const [adoptMsg, setAdoptMsg] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    saveName(n);
    saveRank(rank);
    onJoin(n, rank);
  };
  return (
    <div className="max-w-md mx-auto mt-10 bg-[#172129]/90 border border-white/10 p-8">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="text-xl font-black">ルームに参加</h2>
        <button type="button" onClick={onHowTo}
          className="inline-flex items-center gap-1.5 border border-white/30 hover:bg-white/10 text-white/90 font-black text-xs px-2.5 py-1.5">
          <span className="inline-flex w-[18px] h-[18px] rounded-full border-[1.5px] border-current text-[11px] items-center justify-center" aria-hidden="true">?</span>
          使い方
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-6 leading-relaxed [word-break:auto-phrase]">
        名前とランクを選んで参加してください。<br />前回の内容が入っています（ランクは参加後も変えられます）。<br />
        操作は代表1人でOK。ほかの人は参加してOBSにURLを入れるだけです。
      </p>
      <p className="text-sm font-bold mb-1.5">最高ランク<span className="text-gray-400 font-normal ml-2">チーム分けの目安になります</span></p>
      <div className="mb-4"><RankSelect value={rank} onChange={setRank} /></div>
      <form onSubmit={submit} className="flex gap-2">
        <input value={name} maxLength={NAME_MAX} onChange={e => setName(e.target.value)} placeholder="名前"
          className="flex-1 bg-[#0F1923] border border-gray-600 text-white px-4 py-3 font-bold outline-none focus:border-[#FF4655]" />
        <button className="bg-[#FF4655] hover:bg-[#D93645] text-white font-black px-6 whitespace-nowrap">参加</button>
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
  // ランダムでチーム分けの演出中（OBSで名前が回っている間）は、この画面でも結果を伏せる
  const shuffling = state.display?.kind === 'teamSetup' && !!state.display.shuffled && now < state.display.startedAt + TEAM_SHUFFLE_MS ? state.display : null;
  // この画面では演出の間だけ大きく見せる（OBSは閉じるまで出し続ける）
  const modal = showReveal && active && active.kind !== 'reroll' && closedEvent !== active.id ? active : null;
  const step = currentStep(state);

  return (
    <div className="w-full">
      {/* 上の帯：URLは画面に出さない（配信に映ってもいいように） */}
      <div className="flex flex-wrap items-center gap-3 mb-2 bg-[#172129]/90 border border-white/10 px-3 py-1.5">
        <a href="/" aria-label="トップへ" className="shrink-0"><img src="/assets/CHAOS_fix.png" alt="CHAOSガチャ" className="h-9 w-auto" /></a>
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
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">最高ランク
            <RankSelect compact value={me?.rank ?? null} onChange={r => { if (!me) return; saveRank(r); act({ type: 'join', uid, name: me.name, rank: r }); }} />
          </span>
          <button className="text-gray-500 text-xs underline hover:text-white" onClick={() => {
            const next = state.owner === memberId ? state.members.find(m => m.id !== memberId) : null;
            const ownerNote = state.owner === memberId
              ? (next ? `\nルームの主は「${next.name}」さんに移ります。` : '\nほかに参加者がいないので、ルームの主はいなくなります。')
              : '';
            if (confirm(`名簿から抜けますか？\nチームの席も外れます。もう一度「参加」を押せば戻れます。${ownerNote}`)) act({ type: 'leave' });
          }}>名簿から抜ける</button>
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
              <p className="mt-2 text-gray-400">ブラウザソースの「表示されていないときにソースをシャットダウン」はオフにしておくと、シーンを切り替えても表示が途切れません。</p>
              <p className="mt-2 text-gray-400">ルームは最後の操作から3日たつと自動で消えます。次の開催では新しいルームを作ってください。</p>
              <p className="mt-2 text-gray-500">カードの位置は URL の末尾に <code>?x=24&amp;y=478&amp;s=1</code>（横・縦・大きさ）で調整できます。</p>
            </div>
          </details>
        </div>
      </div>

      {/* OBSは「最後に参加したルーム」を映すので、別のルームを開いていると映らない。気づけるように知らせる */}
      {me && !me.online && (
        <div className="mb-2 flex flex-wrap items-center gap-3 px-3 py-1 bg-[#46CBFF]/10 border border-[#46CBFF]/40 text-sm">
          <span>
            <b className="text-[#46CBFF]">あなたのOBSはこのルームを映していません。</b>
            別のルームを表示中か、OBSが起動していません（OBSを使わない人はそのままでOKです）。
          </span>
          <button className={`${btnBlue} ml-auto py-0.5 text-xs`} onClick={() => act({ type: 'join', uid, name: me.name })}>
            OBSをこのルームに切り替える
          </button>
        </div>
      )}

      <Guide step={step} state={state} locked={locked} act={act} />

      {/* 抽選中のお知らせは、ロゴ横の空いている所に重ねて出す（下の表示がずれないように） */}
      {shuffling && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[150] px-5 py-2 rounded-full bg-[#ffd83b] text-[#2b2a3f] text-sm font-black shadow-[0_6px_20px_rgba(0,0,0,.5)] whitespace-nowrap">
          {shuffling.by}さんがチーム分け中…（OBSで発表中）
        </div>
      )}
      {locked && e && !shuffling && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[150] px-5 py-2 rounded-full bg-[#FF4655] text-white text-sm font-black shadow-[0_6px_20px_rgba(0,0,0,.5)] whitespace-nowrap">
          {e.by}さんが{e.kind === 'map' ? 'マップ' : e.kind === 'team' ? SIDE_LABEL[e.side] : '振り直し'}を抽選中…
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(560px,720px)_minmax(0,1fr)] items-start [&>*]:min-w-0">
        <div>
          <Roster members={state.members} memberId={memberId} owner={state.owner ?? null} act={act} focus={step === 'gather'} started={!!(state.teams.ATK || state.teams.DEF)} shuffling={!!shuffling} />
          {/* 11/17 本人：回す人以外は、この画面を閉じてよいことを枠の外に薄い赤字で */}
          <p className="text-[13px] mt-2 px-1 leading-relaxed"><span className="text-[#FF4655]/70">参加してOBSの設定が済んだら、代表して回す人以外はこの画面を閉じて大丈夫です。</span><br /><span className="text-white/50">名前やランクを変えるときは、招待リンクからまた開いてください。</span></p>
        </div>
        <div className="grid gap-3 [&>*]:min-w-0">
          <div className="grid gap-3 md:grid-cols-2 items-start [&>*]:min-w-0">
            {(['ATK', 'DEF'] as Side[]).map(side => (
              <TeamPanel key={side} side={side} state={state} locked={locked} act={act}
                focus={step === (side === 'ATK' ? 'atk' : 'def')}
                rerolling={active?.kind === 'reroll' && active.side === side ? active.index : null}
                rerollTarget={active?.kind === 'reroll' && active.side === side ? active.target : null}
                revealing={active?.kind === 'team' && active.side === side} shuffling={!!shuffling} />
            ))}
          </div>
          <MapPanel state={state} locked={locked} act={act} focus={step === 'map'} spinning={active?.kind === 'map'} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-4">
        <button className={btnGhost} onClick={() => {
          if (confirm('新しい試合を始めますか？\n全員の抽選結果・OBSの表示・マップのPICK/BANが消えます。\n（チーム分けと、一度出たマップの「済」は残ります）')) act({ type: 'newMatch' });
        }}>新しい試合（結果をリセット）</button>
        {import.meta.env.DEV && (
          // 手元の確認用（本番には出ない）：ランクばらばらの試験の参加者を入れる
          <button className={`${btnGhost} border-dashed`} onClick={async () => {
            const n = Math.max(0, 10 - state.members.length) || 9;
            const ranks = ['radiant', 'iron', 'immortal', 'bronze', 'ascendant', 'silver', 'diamond', 'gold', 'platinum', null, 'gold', 'diamond'];
            await addDummyMembers(location.pathname.split('/').pop() ?? '', n, ranks.sort(() => Math.random() - 0.5));
          }}>（手元だけ）試験の参加者を入れる</button>
        )}
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
        : <>左の名簿の「ATK・DEF」を押して <b>5人ずつ</b> 振り分けましょう（「ランダムでチーム分け」でもOK）（今 ATK {n('ATK')}/5・DEF {n('DEF')}/5）。</>;
      action = <>
        <button className={btnGhost} onClick={() => randomTeams(!!(state.teams.ATK || state.teams.DEF), act)}>ランダムでチーム分け</button>
        <TeamSetupButton state={state} locked={locked} act={act} />
      </>;
      break;
    case 'atk':
      if (state.display?.kind !== 'teamSetup') {
        text = <>10人そろいました！チーム分けを <b className="text-[#ffd83b]">OBSに出して</b> みんなに見せてから、<b className="text-[#FF4655]">ATTACKER</b> を回しましょう。</>;
        action = <>
          <TeamSetupButton state={state} locked={locked} act={act} />
          <button className={`${btnRed} text-base px-6`} disabled={locked} onClick={() => act({ type: 'roll', side: 'ATK' })}>ATTACKERを回す</button>
        </>;
        break;
      }
      text = <>チーム分けをOBSに表示中。よければ <b className="text-[#FF4655]">ATTACKER</b> を回しましょう。</>;
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
        text = <>右下の <b className="text-[#ffd83b]">MAP</b> で BAN／PICK を選び、マップを押して印 → 「マップを回す」。印は全員のOBSにそのまま映ります。</>;
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
        if (confirm('新しい試合を始めますか？\n全員の抽選結果・OBSの表示・マップのPICK/BANが消えます。\n（チーム分けと、一度出たマップの「済」は残ります）')) act({ type: 'newMatch' });
      }}>新しい試合</button>;
      break;
  }

  return (
    <div className="mb-2 bg-[#172129]/90 border border-[#ffd83b]/40 px-3 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
      <ol className="flex flex-wrap items-center gap-1.5">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
              i < doneIndex ? 'border-emerald-400/50 text-emerald-300 bg-emerald-400/10'
                : i === doneIndex ? 'border-[#ffd83b] text-[#2b2a3f] bg-[#ffd83b]'
                : 'border-white/15 text-white/40'}`}>
              {i < doneIndex ? '✓' : i + 1} {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="text-white/20">›</span>}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[320px]">
        <span className="text-[#ffd83b] font-black text-sm">▶ 次にやること</span>
        <span className="text-sm leading-snug flex-1 min-w-[240px]">{text}<span className="text-xs text-gray-500 ml-2">操作は代表1人でOK</span></span>
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

const SEAT_ORDER: Seat[] = ['ATK', 'WATCH', 'DEF'];
const SEAT_ON: Record<Seat, string> = { ATK: 'bg-[#FF4655] text-white', DEF: 'bg-[#46CBFF] text-[#0F1923]', WATCH: 'bg-white/25 text-white' };

/** 名簿：2列。1人ずつ「ATK・観戦・DEF」の3つのボタンで行き先を選ぶ */
/** 回す前のチーム分け（名前とランク）をOBSに出す。出している間は席を動かすとそのまま映る */
function TeamSetupButton({ state, locked, act }: { state: RoomState; locked: boolean; act: Act }) {
  const on = state.display?.kind === 'teamSetup';
  return (
    <button className={`${on ? btnGhost : btnYellow} text-base px-5`} disabled={locked || on} onClick={() => act({ type: 'showTeamSetup' })}>
      {on ? '✓ チーム分けをOBSに表示中' : 'チーム分けをOBSに出す'}
    </button>
  );
}

/** ランダムでチーム分け。縛りガチャを回し始めた後は、押し間違いに備えて確かめる（11/17 本人。文言はほかの確認とそろえる） */
function randomTeams(started: boolean, act: Act) {
  if (started && !confirm('チーム分けをやり直しますか？\nもう縛りガチャを回し始めています。やり直すと、回した結果はもう一度回し直しが必要になります。')) return;
  act({ type: 'randomTeams' });
}

function Roster({ members, memberId, owner, act, focus, started, shuffling }: { members: Member[]; memberId: string; owner: string | null; act: Act; focus: boolean; started: boolean; shuffling: boolean }) {
  const count = (seat: Seat) => members.filter(m => m.seat === seat).length;
  const points = (seat: Seat) => teamPoints(members.filter(m => m.seat === seat));
  const iAmOwner = owner === memberId;
  return (
    <section className={panel(focus)}>
      <div className="flex items-center gap-3 mb-2">
        <h3 className="font-black text-lg">参加者 {members.length}人</h3>
        <span className="text-[11px] text-gray-400">押した所の陣営に入る</span>
        <button className={`${btnYellow} ml-auto text-base px-5 py-2.5`} disabled={shuffling} onClick={() => randomTeams(started, act)}>{shuffling ? 'チーム分け中…' : 'ランダムでチーム分け'}</button>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-2.5 gap-y-1.5">
        {members.map(m => (
          <li key={m.id} className={`flex items-center gap-1.5 h-11 px-2 bg-[#1f2a33] border border-white/5 text-base ${m.seat === 'WATCH' ? 'text-white/60' : ''}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.online ? 'bg-emerald-400' : 'bg-white/15'}`} title={m.online ? 'OBS起動中' : ''} />
            <span className="truncate font-bold min-w-0 flex-1">
              {m.id === owner && <span className="text-[#ffd83b] mr-0.5" title="ルームの主">★</span>}
              {m.name}{m.id === memberId && <span className="text-[10px] text-gray-400 font-normal ml-1">あなた</span>}
            </span>
            <RankChip rank={m.rank} size="xs" />
            <span className="inline-flex shrink-0 border border-white/20">
              {SEAT_ORDER.map(seat => (
                <button key={seat} disabled={shuffling} onClick={() => m.seat !== seat && act({ type: 'seat', memberId: m.id, seat })} aria-pressed={!shuffling && m.seat === seat}
                  className={`w-[38px] h-8 inline-flex items-center justify-center text-xs font-black ${shuffling ? 'text-white/25 animate-pulse' : m.seat === seat ? SEAT_ON[seat] : 'text-white/40 hover:text-white hover:bg-white/10'}`}>
                  {SEAT_LABEL[seat]}
                </button>
              ))}
            </span>
            {iAmOwner && (m.id === memberId ? <span className="shrink-0 w-4" /> : (
              <button title={`${m.name}さんを名簿から外す`} aria-label={`${m.name}さんを名簿から外す`}
                onClick={() => {
                  if (confirm(`「${m.name}」さんを名簿から外しますか？\nチームの席も外れます（本人はもう一度参加すれば戻れます）。`)) act({ type: 'kick', memberId: m.id });
                }}
                className="shrink-0 w-4 h-8 inline-flex items-center justify-center text-white/40 hover:text-[#FF4655] text-base leading-none">×</button>
            ))}
          </li>
        ))}
      </ul>
      {shuffling ? <div className="text-[13px] text-gray-300 mt-2 animate-pulse">チーム分け中…（OBSの発表が終わると出ます）</div> : <div className="text-[13px] text-gray-300 mt-2">
        <span className={count('ATK') > TEAM_SIZE ? 'text-amber-300 font-bold' : ''}>ATK {count('ATK')}/{TEAM_SIZE}（{points('ATK')}点）</span>・
        <span className={count('DEF') > TEAM_SIZE ? 'text-amber-300 font-bold' : ''}>DEF {count('DEF')}/{TEAM_SIZE}（{points('DEF')}点）</span>・
        観戦 {count('WATCH')}人
      </div>}
      <p className="text-xs text-gray-400 mt-1">チーム分けは、最高ランクの点数の合計が近くなるように分けます（未設定は{UNRANKED_POINTS}点）{iAmOwner && '／× で名簿から外す（ルームの主だけ）'}</p>
    </section>
  );
}

/** 縛りのレア度名を、その色の小さな文字で（チームの欄では色はここだけ） */
const RarityText = ({ rarity }: { rarity: BindRarity }) => (
  <span className="shrink-0 text-[10px] font-black mr-1.5" style={{ color: RARITY_COLOR[rarity] }}>{rarity.toUpperCase()}</span>
);

/** 行を押すと下に開く、大きな操作の帯 */
function SlotTools({ member, act, extraBtns }: { member: Member | undefined; act: Act; extraBtns?: ReactNode }) {
  if (!member) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 px-2.5 py-2 bg-[#24313c] border-t border-white/10">
      {extraBtns}
      <label className="inline-flex items-center gap-1.5 h-8 px-2 border border-white/20 text-xs text-gray-300">縛りの指定
        <RaritySelect value={member.bindPick ?? null} onChange={r => act({ type: 'bindPick', memberId: member.id, rarity: r })} />
      </label>
      <label className="inline-flex items-center gap-1.5 h-8 px-2 border border-white/20 text-xs text-gray-300">2つ目
        <RaritySelect value={member.extraRarity ?? null} onChange={r => act({ type: 'extraBind', memberId: member.id, rarity: r })} />
      </label>
    </div>
  );
}

const toolBtn = 'inline-flex items-center justify-center h-8 px-3 text-xs font-black bg-[#33414d] border border-white/20 hover:bg-[#3d4d5a] disabled:opacity-30';

function TeamPanel({ side, state, locked, act, rerolling, rerollTarget, revealing, focus, shuffling }: {
  side: Side; state: RoomState; locked: boolean; act: Act; rerolling: number | null; rerollTarget: 'agent' | 'bind' | 'extra' | null; revealing: boolean; focus: boolean; shuffling: boolean;
}) {
  const roll = state.teams[side];
  const seated = state.members.filter(m => m.seat === side);
  const color = side === 'ATK' ? 'text-[#FF4655]' : 'text-[#46CBFF]';
  const edge = side === 'ATK' ? 'border-l-[3px] border-[#FF4655]' : 'border-l-[3px] border-[#46CBFF]';
  const changed = roll && (roll.slots.length !== seated.length || roll.slots.some(s => !seated.some(m => m.id === s.memberId)));
  // 操作の帯を開いている人
  const [openId, setOpenId] = useState<string | null>(null);
  // 開いた帯は、その人の行の外を触ったら閉じる（11/17 本人「設定だけして次の操作できたほうが楽」）。押した瞬間でなく押し終わってから閉じる（押した瞬間に閉じると下の欄が上にずれて、別のボタンを押してしまう）
  useEffect(() => {
    if (!openId) return;
    const close = (e: MouseEvent) => {
      const row = (e.target as Element | null)?.closest?.('[data-slot]');
      // 人の行を押したときは、その行の onClick が切り替える（押す瞬間に閉じると行が上にずれて、別の人を開いてしまう）
      if (!row || row.getAttribute('data-side') !== side) setOpenId(null);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openId, side]);
  const memberOf = (id: string) => state.members.find(m => m.id === id);
  const pickNote = (m?: Member) => m && (m.bindPick || m.extraRarity)
    ? <span className="text-[13px] text-gray-400 ml-2">{m.bindPick && `指定 ${m.bindPick}`}{m.bindPick && m.extraRarity && '・'}{m.extraRarity && `2つ目 ${m.extraRarity}`}</span> : null;

  return (
    <section className={panel(focus)}>
      <div className="flex items-center gap-2 mb-2">
        <h3 className={`font-black text-lg italic tracking-wider ${color}`}>{SIDE_LABEL[side]}</h3>
        <span className="text-xs text-gray-400">{shuffling ? '？' : seated.length}/{TEAM_SIZE}人</span>
        <button disabled={locked || seated.length !== TEAM_SIZE} onClick={() => act({ type: 'roll', side })}
          className={`${side === 'ATK' ? btnRed : btnBlue} py-1.5 ml-auto`}>
          {roll ? '回し直す' : '回す'}
        </button>
      </div>
      {shuffling ? (
        <div className="bg-[#1f2a33] p-4 text-sm text-gray-300 animate-pulse">チーム分け中…（OBSで発表中。終わるとここに出ます）</div>
      ) : roll && revealing ? (
        <div className="bg-[#1f2a33] p-4 text-sm text-gray-300 animate-pulse">抽選中…（OBSで発表中。終わるとここに出ます）</div>
      ) : roll ? (
        <ul className="space-y-1">
          {roll.slots.map((s, i) => {
            const m = memberOf(s.memberId);
            const open = openId === s.memberId;
            const hideAgent = rerolling === i && rerollTarget === 'agent';
            const hideBind = rerolling === i && rerollTarget === 'bind';
            const hideExtra = rerolling === i && rerollTarget === 'extra';
            return (
              <li key={s.memberId} data-slot={s.memberId} data-side={side} className={`bg-[#1f2a33] ${edge} ${open ? 'outline outline-1 outline-white/25' : ''} ${rerolling === i ? 'animate-pulse' : ''}`}>
                <button type="button" onClick={() => setOpenId(open ? null : s.memberId)} aria-expanded={open}
                  className="w-full flex items-stretch gap-2 text-left hover:bg-white/[0.03]">
                  <img src={s.agent.image} alt="" className={`w-[60px] h-[72px] object-cover object-top shrink-0 ${hideAgent ? 'blur-md opacity-40' : ''}`} />
                  <span className="min-w-0 flex-1 py-1 flex flex-col justify-center gap-0.5">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <b className="text-[17px] truncate">{s.name}</b>
                      <span className="text-[13px] text-gray-400 inline-flex items-center gap-1 shrink-0"><RoleIcon role={s.agent.role} size={13} />{hideAgent ? '抽選中…' : s.agent.name}</span>
                      {pickNote(m)}
                    </span>
                    <span className="flex items-baseline text-[15px] text-white/85 leading-snug"><RarityText rarity={s.bind.rarity} /><span>{hideBind ? '抽選中…' : s.bind.text.replace(/\n/g, ' ')}</span></span>
                    {s.extra && <span className="flex items-baseline text-[15px] text-white/85 leading-snug"><RarityText rarity={s.extra.rarity} /><span>{hideExtra ? '抽選中…' : s.extra.text.replace(/\n/g, ' ')}<span className="text-gray-400 ml-1">（2つ目）</span></span></span>}
                  </span>
                  <span className="shrink-0 self-center px-2 text-gray-400 text-xs" aria-hidden="true">{open ? '▴' : '▾'}</span>
                </button>
                {open && (
                  <SlotTools member={m} act={act} extraBtns={<>
                    <button disabled={locked} className={toolBtn} onClick={() => act({ type: 'reroll', side, index: i, target: 'agent' })}>↻ エージェントを引き直す</button>
                    <button disabled={locked} className={toolBtn} onClick={() => act({ type: 'reroll', side, index: i, target: 'bind' })}>↻ 縛りを引き直す</button>
                    {s.extra && <button disabled={locked} className={toolBtn} onClick={() => act({ type: 'rerollExtra', side, index: i })}>↻ 2つ目を引き直す</button>}
                  </>} />
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <>
        <ul className="space-y-1 flex-1">
          {seated.map(m => {
            const open = openId === m.id;
            return (
              <li key={m.id} data-slot={m.id} data-side={side} className={`bg-[#1f2a33] ${edge} ${open ? 'outline outline-1 outline-white/25' : ''}`}>
                <button type="button" onClick={() => setOpenId(open ? null : m.id)} aria-expanded={open}
                  className="w-full h-10 flex items-center gap-2 px-2.5 text-left hover:bg-white/[0.03]">
                  <b className="text-base truncate">{m.name}</b><RankChip rank={m.rank} />{pickNote(m)}
                  <span className="ml-auto text-[11px] text-gray-400">{open ? '▴' : '縛りの指定 ▾'}</span>
                </button>
                {open && <SlotTools member={m} act={act} />}
              </li>
            );
          })}
          {!seated.length && <li className="text-sm text-gray-400 p-2">左の名簿で「{side}」を押して振り分けてください</li>}
          {seated.length > 0 && seated.length < TEAM_SIZE && <li className="text-xs text-gray-500 p-1">あと{TEAM_SIZE - seated.length}人</li>}
        </ul>
        </>
      )}
      {!shuffling && seated.length > TEAM_SIZE && <p className="text-xs text-amber-300 mt-2">{seated.length}人います。5人にすると回せます。</p>}
      {!shuffling && changed && seated.length <= TEAM_SIZE && <p className="text-xs text-amber-300 mt-2">メンバーが変わっています。回し直すと反映されます。</p>}
    </section>
  );
}

/** マップ：右下に横長。手順は1行にまとめる（①OBSに出す ②BAN/PICK ③マップを押す ④回す） */
function MapPanel({ state, locked, act, focus, spinning }: { state: RoomState; locked: boolean; act: Act; focus: boolean; spinning: boolean }) {
  const mode: MapMode = state.mapMode ?? 'BAN';
  const marks = state.mapMarks ?? [];
  const pool = mapPool(MAPS.map(m => m.id), state);
  // いきなり回すとOBS側の準備が追いつかないので、先に候補をOBSに出してから回す
  const ready = state.display?.kind === 'mapSetup' || state.display?.kind === 'map';
  return (
    <section className={panel(focus)}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h3 className="font-black text-lg italic tracking-wider text-[#ffd83b] mr-1">MAP</h3>
        <button disabled={locked || state.display?.kind === 'mapSetup'} onClick={() => act({ type: 'showMapSetup' })}
          className={`${ready ? btnGhost : btnYellow} py-1 px-3 text-xs`}>{ready ? '✓ OBSに表示中' : '① 候補をOBSに出す'}</button>
        <div className={`flex bg-black/40 p-1 border border-white/20 ${ready ? '' : 'opacity-50'}`}>
          {(['BAN', 'PICK'] as MapMode[]).map(m => (
            <button key={m} onClick={() => act({ type: 'mapMode', mode: m })}
              className={`px-3 h-8 inline-flex items-center text-[13px] font-black whitespace-nowrap ${mode === m ? (m === 'PICK' ? 'bg-[#FF4655] text-white' : 'bg-[#46CBFF] text-[#0F1923]') : 'text-white/45 hover:text-white'}`}>
              {m}<span className="font-bold ml-1">{m === 'PICK' ? '押したマップから選ぶ' : '押したマップを外す'}</span>
            </button>
          ))}
        </div>
        <span className="text-[11px] text-gray-400">マップを押して印（もう一度押すと戻る）</span>
        <button disabled={locked || pool.length === 0 || !ready} onClick={() => act({ type: 'mapRoll' })}
          title={ready ? '' : '先に「候補をOBSに出す」を押してください'}
          className={`${btnYellow} py-1.5 px-4 ml-auto whitespace-nowrap`}>マップを回す（候補{pool.length}）</button>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {MAPS.map(m => {
          const marked = marks.includes(m.id);
          const used = state.mapHistory.includes(m.id);
          // 抽選の演出中は、決まったマップを伏せる（OBS と同じ時に出す）
          const current = state.map === m.id && !spinning;
          const out = (mode === 'BAN' && marked) || (mode === 'PICK' && !marked) || (used && !current && !(spinning && state.map === m.id));
          return (
            <button key={m.id} onClick={() => act({ type: 'mapMark', mapId: m.id })}
              className={`relative aspect-video overflow-hidden border-2 ${current ? 'border-[#ffd83b]' : marked ? (mode === 'PICK' ? 'border-[#FF4655]' : 'border-[#46CBFF]') : 'border-white/10'}`}>
              <img src={mapImage(m)} alt="" className={`absolute inset-0 w-full h-full object-cover ${out ? 'grayscale opacity-30' : ''}`} />
              <span className="absolute inset-x-0 bottom-0 text-sm font-black tracking-wider bg-black/60 py-0.5">{m.name}</span>
              {(current || (used && !(spinning && state.map === m.id)) || marked) && (
                <span className={`absolute top-1 left-1 text-xs font-black px-1.5 py-0.5 ${
                  current ? 'bg-[#ffd83b] text-[#2b2a3f]' : marked ? (mode === 'PICK' ? 'bg-[#FF4655] text-white' : 'bg-[#46CBFF] text-[#0F1923]') : 'bg-black/80 text-white'}`}>
                  {current ? '今回' : marked ? (used ? `${mode}・済` : mode) : '済'}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500">
        <span>一度出たマップは「済」になり、次から外れます。</span>
        <button className="hover:text-white underline disabled:opacity-40" disabled={!state.mapHistory.length} onClick={() => act({ type: 'mapClearHistory' })}>出たマップを戻す</button>
      </div>
    </section>
  );
}
