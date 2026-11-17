import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MAPS, mapImage } from '../data/maps';
import {
  ROOM_PATTERN, NAME_MAX, TEAM_SIZE, eventDuration, mapPool,
  type ClientMessage, type MapMode, type Member, type RoomState, type Seat, type Side,
} from '../logic/room';
import { createRoom, useRoom, useServerNow } from './connection';
import { adoptUid, getSavedName, getUid, overlayUrl, saveName } from './identity';
import { MapReveal, RarityBadge, ROLE_LABEL, SIDE_LABEL, Stage, TeamReveal } from './reveal';
import { RoleIcon } from './RoleIcon';
import { HowToModal } from './HowToModal';

const SEAT_NEXT: Record<Seat, Seat> = { WATCH: 'ATK', ATK: 'DEF', DEF: 'WATCH' };
const SEAT_STYLE: Record<Seat, string> = {
  ATK: 'bg-[#ff4655] text-white',
  DEF: 'bg-[#3fb7ec] text-[#101418]',
  WATCH: 'bg-[#222a33] text-[#9aa3ad]',
};
const SEAT_LABEL: Record<Seat, string> = { ATK: 'ATK', DEF: 'DEF', WATCH: '観戦' };
const SHOW_REVEAL_KEY = 'chaos-gacha:page-reveal';

// 対戦ロビーの見た目：枠線の無い平たい板。攻め＝赤、守り＝青、マップ＝黄
const btn = 'inline-flex items-center justify-center gap-2 font-extrabold text-sm px-4 py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const btnGhost = `${btn} bg-[#222a33] text-[#ece8e1] hover:bg-[#2c3640]`;
const btnRed = `${btn} text-white bg-[#ff4655] hover:bg-[#ff5e6b]`;
const btnBlue = `${btn} text-[#101418] bg-[#3fb7ec] hover:bg-[#62c6f0]`;
const btnYellow = `${btn} text-[#101418] bg-[#ffd83b] hover:bg-[#ffe066]`;

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/** トップ／ガチャ画面に置く「ルームを作る」ボタン */
export function CreateRoomButton() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div className="mt-8 bg-[#1a2027] border-l-4 border-[#3fb7ec] p-6 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1">
        <h3 className="text-lg font-extrabold mb-1">みんなで同じ画面を見る・配信に映す</h3>
        <p className="text-sm text-[#9aa3ad] leading-relaxed">
          ルームを作ってリンクを共有すると、誰かが回した結果が全員の画面とOBSに自動で出ます。
        </p>
        {failed && <p className="text-[#ff4655] text-sm font-bold mt-2">{failed}</p>}
      </div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true); setFailed(null);
          try { navigate(`/r/${await createRoom()}`, { state: { howto: true } }); } catch (e) { setFailed((e as Error).message); } finally { setBusy(false); }
        }}
        className={`${btnBlue} text-base px-8 py-4 shrink-0`}
      >
        {busy ? '作成中…' : 'ルームを作る'}
      </button>
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
        <h2 className="text-2xl font-extrabold mb-4">このルームは見つかりません</h2>
        <p className="text-[#9aa3ad] text-sm mb-8">終了したか、リンクが作り直された可能性があります。最新のリンクをもらってください。</p>
        <button className={btnGhost} onClick={() => navigate('/gacha')}>ガチャへ戻る</button>
      </div>
    );
  }
  if (!room.state) {
    return <>{howtoModal}<div className="text-center mt-24 text-xl font-extrabold animate-pulse">ルームにつないでいます…</div></>;
  }
  if (!room.memberId) {
    return <>{howtoModal}<JoinForm onJoin={name => room.act({ type: 'join', uid, name })} error={room.error}
      onHowTo={() => setHowto('again')}
      onAdopt={input => { if (!adoptUid(input)) return false; setUid(getUid()); return true; }} /></>;
  }
  return <>{howtoModal}<RoomView room={room} state={room.state} uid={uid} memberId={room.memberId} /></>;
}

function JoinForm({ onJoin, onAdopt, onHowTo, error }: {
  onJoin: (name: string) => void;
  onHowTo: () => void;
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
    <div className="max-w-md mx-auto mt-10 bg-[#1a2027] border-t-4 border-[#ff4655] p-8">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="text-2xl font-extrabold">ルームに参加</h2>
        <button type="button" onClick={onHowTo}
          className="inline-flex items-center gap-1.5 bg-[#222a33] hover:bg-[#2c3640] text-[#ece8e1] font-extrabold text-xs px-2.5 py-1.5">
          <span className="inline-flex w-[18px] h-[18px] rounded-full border-[1.5px] border-current text-[11px] items-center justify-center" aria-hidden="true">?</span>
          使い方
        </button>
      </div>
      <p className="text-sm text-[#9aa3ad] mb-6 leading-relaxed">
        名前を入れて参加してください（次回からは自動で入ります）。<br />
        操作は代表1人でOK。ほかの人は参加してOBSにURLを入れるだけです。
      </p>
      <form onSubmit={submit} className="flex gap-2">
        <input value={name} maxLength={NAME_MAX} onChange={e => setName(e.target.value)} placeholder="名前"
          className="flex-1 bg-[#101418] border border-white/15 text-[#ece8e1] px-4 py-3 font-bold outline-none focus:border-[#ff4655]" />
        <button className={`${btnRed} text-base px-6 whitespace-nowrap`}>参加</button>
      </form>
      {error && <p className="text-[#ff4655] text-sm font-bold mt-3">{error}</p>}
      <details className="mt-8 text-sm text-[#9aa3ad]">
        <summary className="cursor-pointer hover:text-white">別のPCで使っていたOBS用URLを引き継ぐ</summary>
        <p className="mt-3 leading-relaxed">いつもと違うPCやブラウザで参加するときは、OBSに入れてあるURLを貼ってください。同じ人として扱われます。</p>
        <div className="flex gap-2 mt-3">
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="…/me/xxxxxxxx"
            className="flex-1 bg-[#101418] border border-white/15 text-[#ece8e1] px-3 py-2 outline-none" />
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
      <div className="flex flex-wrap items-center gap-3 mb-3 bg-[#1a2027] px-4 py-3">
        <span className="text-base font-extrabold">ルーム</span>
        <span className={`w-2.5 h-2.5 rounded-full ${room.status === 'open' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}
          title={room.status === 'open' ? '接続中' : '再接続中'} />
        <button className={btnGhost} onClick={() => copyToast(location.href, '招待リンク')}>招待リンクをコピー</button>
        <button className="text-xs text-[#9aa3ad] hover:text-[#ece8e1] underline" onClick={() => {
          if (confirm('リンクを作り直しますか？\n今のリンクは使えなくなります（名簿と結果はそのまま引き継ぎます）。')) act({ type: 'regenerate' });
        }}>リンクを作り直す</button>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
          <span className="text-[#9aa3ad]">あなた：<b className="text-[#ece8e1] text-base">{me?.name}</b></span>
          <button className="text-[#9aa3ad] text-xs underline hover:text-[#ece8e1]" onClick={() => {
            const n = prompt('新しい名前', me?.name ?? '')?.trim();
            if (n) { saveName(n); act({ type: 'join', uid, name: n }); }
          }}>名前を変更</button>
          <button className="text-[#9aa3ad] text-xs underline hover:text-[#ece8e1]" onClick={() => {
            const next = state.owner === memberId ? state.members.find(m => m.id !== memberId) : null;
            const ownerNote = state.owner === memberId
              ? (next ? `\nルームの主は「${next.name}」さんに移ります。` : '\nほかに参加者がいないので、ルームの主はいなくなります。')
              : '';
            if (confirm(`名簿から抜けますか？\nチームの席も外れます。もう一度「参加」を押せば戻れます。${ownerNote}`)) act({ type: 'leave' });
          }}>名簿から抜ける</button>
          <span className="text-[#9aa3ad]">OBS用URL</span>
          <code className="bg-[#101418] px-2 py-1 text-xs select-none">{peek ? overlayUrl(uid) : `…/me/${'●'.repeat(8)}`}</code>
          <button className={btnGhost} onClick={() => copyToast(overlayUrl(uid), 'OBS用URL')}>コピー</button>
          <button className="text-[#9aa3ad] text-xs hover:text-[#ece8e1]" onPointerDown={() => setPeek(true)}
            onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)}>押している間表示</button>
          <details className="relative text-xs text-[#9aa3ad]">
            <summary className="cursor-pointer hover:text-[#ece8e1] list-none underline">OBSの設定方法</summary>
            <div className="absolute right-0 top-6 z-50 w-[420px] max-w-[90vw] bg-[#101418] border border-white/15 p-4 shadow-2xl text-sm leading-relaxed text-[#ece8e1]">
              <ol className="list-decimal ml-5 space-y-1">
                <li>「コピー」でOBS用URLをコピーします。</li>
                <li>OBSで「ソース」→「＋」→「ブラウザ」を追加し、URLに貼り付けます。幅 1920・高さ 1080。</li>
                <li>ゲーム画面より上、V体より下に置いて、画面全体に広げます。</li>
                <li>次回からは、新しいルームで「参加」を押すだけでOBSも切り替わります。</li>
              </ol>
              <p className="mt-2 text-[#9aa3ad]">ブラウザソースの「表示されていないときにソースをシャットダウン」はオフにしておくと、シーンを切り替えても表示が途切れません。</p>
              <p className="mt-2 text-[#9aa3ad]">ルームは最後の操作から3日たつと自動で消えます。次の開催では新しいルームを作ってください。</p>
              <p className="mt-2 text-[#9aa3ad]">カードの位置は URL の末尾に <code>?x=24&amp;y=478&amp;s=1</code>（横・縦・大きさ）で調整できます。</p>
            </div>
          </details>
        </div>
      </div>

      {/* OBSは「最後に参加したルーム」を映すので、別のルームを開いていると映らない。気づけるように知らせる */}
      {me && !me.online && (
        <div className="mb-3 flex flex-wrap items-center gap-3 px-4 py-3 bg-[#3fb7ec]/10 border-l-4 border-[#3fb7ec] text-sm">
          <span>
            <b className="text-[#3fb7ec]">あなたのOBSはこのルームを映していません。</b>
            別のルームを表示中か、OBSが起動していません（OBSを使わない人はそのままでOKです）。
          </span>
          <button className={`${btnBlue} ml-auto py-1`} onClick={() => act({ type: 'join', uid, name: me.name })}>
            OBSをこのルームに切り替える
          </button>
        </div>
      )}

      <Guide step={step} state={state} locked={locked} act={act} />

      {/* 抽選中のお知らせは、ロゴ横の空いている所に重ねて出す（下の表示がずれないように） */}
      {locked && e && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[150] px-5 py-2 bg-[#ff4655] text-white text-sm font-extrabold shadow-[0_6px_20px_rgba(0,0,0,.5)] animate-pulse whitespace-nowrap">
          {e.by}さんが{e.kind === 'map' ? 'マップ' : e.kind === 'team' ? SIDE_LABEL[e.side] : '振り直し'}を抽選中…
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)] items-start [&>*]:min-w-0">
        <Roster members={state.members} memberId={memberId} owner={state.owner ?? null} act={act} focus={step === 'gather'} />
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)] items-start [&>*]:min-w-0">
          <TeamPanel side="ATK" state={state} locked={locked} act={act} focus={step === 'atk'}
            rerolling={active?.kind === 'reroll' && active.side === 'ATK' ? active.index : null} />
          <div className="hidden xl:flex items-center justify-center self-stretch text-4xl font-extrabold text-white/25" aria-hidden="true">VS</div>
          <TeamPanel side="DEF" state={state} locked={locked} act={act} focus={step === 'def'}
            rerolling={active?.kind === 'reroll' && active.side === 'DEF' ? active.index : null} />
        </div>
      </div>
      <div className="mt-3">
        <MapPanel state={state} locked={locked} act={act} focus={step === 'map'} />
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-4">
        <button className={btnGhost} onClick={() => {
          if (confirm('新しい試合を始めますか？\n全員の抽選結果・OBSの表示・マップのPICK/BANが消えます。\n（チーム分けと、一度出たマップの「済」は残ります）')) act({ type: 'newMatch' });
        }}>新しい試合（結果をリセット）</button>
        <label className="flex items-center gap-2 text-sm text-[#9aa3ad] cursor-pointer">
          <input type="checkbox" checked={showReveal} onChange={ev => {
            setShowReveal(ev.target.checked);
            try { localStorage.setItem(SHOW_REVEAL_KEY, ev.target.checked ? 'on' : 'off'); } catch { /* 保存できない環境 */ }
          }} />
          この画面でも抽選の演出を見る
        </label>
      </div>

      {(room.error || toast) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 font-bold text-sm shadow-2xl bg-[#ece8e1] text-[#101418]">
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
      text = <>10人そろいました！まずは <b className="text-[#ff4655]">ATTACKER</b> を回しましょう。</>;
      action = <button className={`${btnRed} text-base px-6`} disabled={locked} onClick={() => act({ type: 'roll', side: 'ATK' })}>ATTACKERを回す</button>;
      break;
    case 'def':
      text = <>ATTACKERの結果を確認。気になる人は <b>顔↻・縛↻</b> で1人ずつ振り直せます。OKなら <b className="text-[#3fb7ec]">DEFENDER</b> へ。</>;
      action = <button className={`${btnBlue} text-base px-6`} disabled={locked} onClick={() => act({ type: 'roll', side: 'DEF' })}>DEFENDERを回す</button>;
      break;
    case 'map':
      if (state.display?.kind !== 'mapSetup') {
        text = <>DEFENDERも確認できたら、<b className="text-[#ffd83b]">マップ候補</b> をOBSに出してみんなで決めましょう。</>;
        action = <button className={`${btnYellow} text-base px-6`} disabled={locked} onClick={() => act({ type: 'showMapSetup' })}>マップ候補をOBSに出す</button>;
      } else {
        text = <>下の <b className="text-[#ffd83b]">マップ</b> で、②選び方（BAN＝外す／PICK＝ここから選ぶ）→ ③マップを押して印 → ④回す。印は全員のOBSにそのまま映ります。</>;
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
    <div className="mb-3 bg-[#1a2027]">
      {/* 進み具合：5つの段を横に並べた帯。済んだ段は暗く、今の段は白く */}
      <ol className="grid grid-cols-[repeat(5,minmax(0,1fr))]">
        {STEPS.map((s, i) => (
          <li key={s.key} className={`flex items-center justify-center gap-1 h-10 px-1 text-[10px] sm:text-sm font-extrabold whitespace-nowrap overflow-hidden ${
            i < doneIndex ? 'bg-[#222a33] text-[#9aa3ad]'
              : i === doneIndex ? 'bg-[#ece8e1] text-[#101418]'
              : 'text-[#9aa3ad]/50'}`}>
            {i < doneIndex && <span aria-hidden="true">✓</span>}{s.label}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="font-extrabold text-sm">次にやること</span>
        <span className="text-sm leading-relaxed flex-1 min-w-[260px]">{text}</span>
        {action}
        {state.display && step !== 'start' && (
          <button className="text-xs text-[#9aa3ad] hover:text-[#ece8e1] underline" onClick={() => act({ type: 'closeDisplay' })}>OBSの結果画面を閉じる</button>
        )}
        <span className="text-xs text-[#9aa3ad] w-full sm:w-auto">操作は代表1人でOK</span>
      </div>
    </div>
  );
}

// 今やる所は、上に白い線を引いて目立たせる
const panel = (focus: boolean) =>
  `bg-[#1a2027] p-4 flex flex-col border-t-2 ${focus ? 'border-[#ece8e1]' : 'border-transparent'}`;

function Roster({ members, memberId, owner, act, focus }: { members: Member[]; memberId: string; owner: string | null; act: Act; focus: boolean }) {
  const count = (seat: Seat) => members.filter(m => m.seat === seat).length;
  const iAmOwner = owner === memberId;
  return (
    <section className={panel(focus)}>
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-lg font-extrabold">参加者 {members.length}人</h3>
        <span className="text-[11px] text-[#9aa3ad] inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />OBS起動中</span>
      </div>
      <p className="text-[11px] text-[#9aa3ad] mb-2">右のボタンで ATK → DEF → 観戦{iAmOwner && <><br />× で名簿から外す（ルームの主だけ）</>}</p>
      <ul className="overflow-y-auto max-h-[440px] pr-1">
        {members.map(m => (
          <li key={m.id} className={`flex items-center gap-2 py-1.5 border-b border-white/5 text-sm ${m.seat === 'WATCH' ? 'text-[#9aa3ad]' : ''}`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${m.online ? 'bg-emerald-400' : 'bg-white/15'}`} />
            <span className="truncate font-bold">
              {m.id === owner && <span className="text-[#ffd83b] mr-1" title="ルームの主">★</span>}
              {m.name}{m.id === memberId && <span className="text-[11px] text-[#9aa3ad] font-normal ml-1">（あなた）</span>}
            </span>
            <button onClick={() => act({ type: 'seat', memberId: m.id, seat: SEAT_NEXT[m.seat] })}
              className={`ml-auto shrink-0 w-12 h-6 inline-flex items-center justify-center text-[11px] font-extrabold ${SEAT_STYLE[m.seat]}`}>{SEAT_LABEL[m.seat]}</button>
            {iAmOwner && (m.id === memberId ? <span className="shrink-0 w-5" /> : (
              <button title={`${m.name}さんを名簿から外す`} aria-label={`${m.name}さんを名簿から外す`}
                onClick={() => {
                  if (confirm(`「${m.name}」さんを名簿から外しますか？\nチームの席も外れます（本人はもう一度参加すれば戻れます）。`)) act({ type: 'kick', memberId: m.id });
                }}
                className="shrink-0 w-5 h-5 inline-flex items-center justify-center text-white/40 hover:text-[#ff4655] hover:bg-white/5 text-sm leading-none">×</button>
            ))}
          </li>
        ))}
      </ul>
      <div className="text-[11px] text-[#9aa3ad] mt-2">
        <span className={count('ATK') > TEAM_SIZE ? 'text-amber-300 font-bold' : ''}>ATK {count('ATK')}/{TEAM_SIZE}</span>・
        <span className={count('DEF') > TEAM_SIZE ? 'text-amber-300 font-bold' : ''}>DEF {count('DEF')}/{TEAM_SIZE}</span>
      </div>
      <button className={`${btnGhost} w-full mt-2`} onClick={() => act({ type: 'randomTeams' })}>ランダムでチーム分け</button>
    </section>
  );
}

/** 攻め（左）と守り（右）が向き合う列。守りは左右を反転して、絵が外側・文字が内側に来る */
function TeamPanel({ side, state, locked, act, rerolling, focus }: {
  side: Side; state: RoomState; locked: boolean; act: Act; rerolling: number | null; focus: boolean;
}) {
  const roll = state.teams[side];
  const seated = state.members.filter(m => m.seat === side);
  const atk = side === 'ATK';
  const changed = roll && (roll.slots.length !== seated.length || roll.slots.some(s => !seated.some(m => m.id === s.memberId)));
  const edge = atk ? 'border-l-[6px] border-[#ff4655]' : 'border-r-[6px] border-[#3fb7ec]';
  const rerollBtn = 'w-14 h-6 inline-flex items-center justify-center text-[11px] font-bold bg-[#101418] text-[#9aa3ad] hover:text-[#ece8e1] disabled:opacity-30';

  return (
    <section className={`flex flex-col ${focus ? 'outline outline-2 outline-[#ece8e1]/70 outline-offset-2' : ''}`}>
      <div className={`flex items-center gap-3 mb-2 ${atk ? '' : 'flex-row-reverse'}`}>
        <h3 className={`text-2xl font-extrabold ${atk ? 'text-[#ff4655]' : 'text-[#3fb7ec]'}`}>{SIDE_LABEL[side]}</h3>
        <span className="text-sm text-[#9aa3ad] font-bold">{seated.length}/{TEAM_SIZE}</span>
        <button disabled={locked || seated.length !== TEAM_SIZE} onClick={() => act({ type: 'roll', side })}
          className={`${atk ? btnRed : btnBlue} ${atk ? 'ml-auto' : 'mr-auto'}`}>
          {roll ? '回し直す' : '回す'}
        </button>
      </div>
      {roll ? (
        <ul className="space-y-1.5">
          {roll.slots.map((s, i) => (
            <li key={s.memberId} className={`flex items-stretch gap-3 bg-[#1a2027] ${edge} ${atk ? '' : 'flex-row-reverse text-right'} ${rerolling === i ? 'animate-pulse' : ''}`}>
              <img src={s.agent.image} alt="" className="w-16 h-[72px] object-cover object-top shrink-0" />
              <div className="min-w-0 flex-1 py-1.5">
                <div className={`flex items-baseline gap-2 ${atk ? '' : 'flex-row-reverse'}`}>
                  <span className="font-extrabold truncate">{s.name}</span>
                  <span className="text-[11px] text-[#9aa3ad] truncate inline-flex items-center gap-1">
                    <RoleIcon role={s.agent.role} size={12} />{s.agent.name}・{ROLE_LABEL[s.agent.role]}
                  </span>
                </div>
                <div className={`flex items-start gap-1.5 mt-1 ${atk ? '' : 'flex-row-reverse'}`}>
                  <RarityBadge rarity={s.bind.rarity} size="sm" />
                  <span className="text-xs text-[#ece8e1]/85 leading-snug line-clamp-2">{s.bind.text.replace(/\n/g, ' ')}</span>
                </div>
              </div>
              <div className="flex flex-col justify-center gap-1 shrink-0 px-2">
                <button disabled={locked} title="エージェントを振り直す" onClick={() => act({ type: 'reroll', side, index: i, target: 'agent' })} className={rerollBtn}>顔↻</button>
                <button disabled={locked} title="縛りを振り直す" onClick={() => act({ type: 'reroll', side, index: i, target: 'bind' })} className={rerollBtn}>縛↻</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className={`bg-[#1a2027] ${edge} p-4 flex-1 min-h-[160px] ${atk ? '' : 'text-right'}`}>
          {seated.length ? (
            <ul className={`flex flex-wrap gap-1.5 ${atk ? '' : 'justify-end'}`}>
              {seated.map(m => <li key={m.id} className="px-3 py-1 bg-[#222a33] font-bold text-sm">{m.name}</li>)}
            </ul>
          ) : <span className="text-sm text-[#9aa3ad]">名簿でメンバーを振り分けてください</span>}
          <div className="mt-2 text-xs text-[#9aa3ad]">{seated.length}/{TEAM_SIZE}人・未抽選</div>
        </div>
      )}
      {seated.length > TEAM_SIZE && <p className="text-xs text-amber-300 mt-2">{seated.length}人います。5人にすると回せます。</p>}
      {changed && seated.length <= TEAM_SIZE && <p className="text-xs text-amber-300 mt-2">メンバーが変わっています。回し直すと反映されます。</p>}
    </section>
  );
}

function MapStep({ no, state, title, children }: { no: number; state: 'done' | 'now' | 'wait'; title: string; children: ReactNode }) {
  const tone = state === 'done' ? 'bg-[#222a33] text-[#9aa3ad]' : state === 'now' ? 'bg-[#222a33] border-l-4 border-[#ffd83b]' : 'bg-[#222a33]/50 opacity-50';
  const badge = state === 'done' ? 'bg-emerald-400 text-[#101418]' : state === 'now' ? 'bg-[#ffd83b] text-[#101418]' : 'bg-white/15 text-[#ece8e1]/70';
  return (
    <li className={`flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 ${tone}`}>
      <span className={`inline-flex w-5 h-5 shrink-0 rounded-full items-center justify-center text-[11px] font-extrabold ${badge}`}>{state === 'done' ? '✓' : no}</span>
      <b className="whitespace-nowrap">{title}</b>
      <span className="ml-auto flex items-center">{children}</span>
    </li>
  );
}

/** マップは横いっぱいの段。左に手順、右にマップの絵 */
function MapPanel({ state, locked, act, focus }: { state: RoomState; locked: boolean; act: Act; focus: boolean }) {
  const mode: MapMode = state.mapMode ?? 'BAN';
  const marks = state.mapMarks ?? [];
  const pool = mapPool(MAPS.map(m => m.id), state);
  // いきなり回すとOBS側の準備が追いつかないので、先に候補をOBSに出してから回す
  const ready = state.display?.kind === 'mapSetup' || state.display?.kind === 'map';
  return (
    <section className={panel(focus)}>
      <h3 className="text-2xl font-extrabold text-[#ffd83b] mb-3">マップ</h3>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div>
          {/* 手順を1〜4の箱で並べる。済んだ所は緑、今やる所は黄色 */}
          <ol className="grid gap-1.5 text-xs">
            <MapStep no={1} state={ready ? 'done' : 'now'} title="候補をOBSに出す">
              <button disabled={locked || state.display?.kind === 'mapSetup'} onClick={() => act({ type: 'showMapSetup' })}
                className={`${ready ? btnGhost : btnYellow} py-1 px-2 text-xs whitespace-nowrap`}>{ready ? 'OBSに表示中' : 'OBSに出す'}</button>
            </MapStep>
            <MapStep no={2} state={ready ? 'now' : 'wait'} title="選び方を決める">
              <div className="flex bg-[#101418] p-0.5">
                {(['BAN', 'PICK'] as MapMode[]).map(m => (
                  <button key={m} onClick={() => act({ type: 'mapMode', mode: m })}
                    className={`px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap ${mode === m ? (m === 'PICK' ? 'bg-[#ff4655] text-white' : 'bg-[#3fb7ec] text-[#101418]') : 'text-[#9aa3ad] hover:text-[#ece8e1]'}`}>
                    {m}<span className="font-bold ml-1">{m === 'PICK' ? '押したマップから選ぶ' : '押したマップを外す'}</span>
                  </button>
                ))}
              </div>
            </MapStep>
            <MapStep no={3} state={ready ? 'now' : 'wait'} title="マップを押して印を付ける">
              <span className="text-[#9aa3ad]">{mode === 'PICK' ? '赤い枠のマップだけが候補' : 'BANの付いたマップは候補から外れる'}（もう一度押すと戻る）</span>
            </MapStep>
            <MapStep no={4} state={ready ? 'now' : 'wait'} title="回す">
              <button disabled={locked || pool.length === 0 || !ready} onClick={() => act({ type: 'mapRoll' })}
                title={ready ? '' : '先に「OBSに出す」を押してください'}
                className={`${btnYellow} py-1 px-3 whitespace-nowrap`}>回す（候補{pool.length}）</button>
            </MapStep>
          </ol>
          <p className="text-[11px] text-[#9aa3ad] mt-2">一度出たマップは「済」になり、次から外れます。</p>
          <button className="text-[11px] text-[#9aa3ad] hover:text-[#ece8e1] underline mt-1 disabled:opacity-40"
            disabled={!state.mapHistory.length} onClick={() => act({ type: 'mapClearHistory' })}>出たマップを戻す</button>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 xl:grid-cols-7 gap-1.5 content-start">
          {MAPS.map(m => {
            const marked = marks.includes(m.id);
            const used = state.mapHistory.includes(m.id);
            const current = state.map === m.id;
            const out = (mode === 'BAN' && marked) || (mode === 'PICK' && !marked) || (used && !current);
            return (
              <button key={m.id} onClick={() => act({ type: 'mapMark', mapId: m.id })}
                className={`relative aspect-video overflow-hidden border-2 ${current ? 'border-[#ffd83b]' : mode === 'PICK' && marked ? 'border-[#ff4655]' : 'border-transparent'}`}>
                <img src={mapImage(m)} alt="" className={`absolute inset-0 w-full h-full object-cover ${out ? 'grayscale opacity-30' : ''}`} />
                {mode === 'BAN' && marked && <span className="absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent_0_10px,rgba(255,70,85,.35)_10px_12px)]" />}
                <span className="absolute inset-x-0 bottom-0 text-[10px] font-extrabold bg-black/60">{m.name}</span>
                {(current || used || marked) && (
                  <span className={`absolute top-0.5 left-0.5 text-[10px] font-extrabold px-1 ${
                    current ? 'bg-[#ffd83b] text-[#101418]' : marked ? (mode === 'PICK' ? 'bg-[#ff4655]' : 'bg-[#101418]') : 'bg-black/70'}`}>
                    {current ? '今回' : marked ? mode : '済'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
