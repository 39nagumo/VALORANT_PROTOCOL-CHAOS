import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Agent, Bind } from '../logic/gacha';
import { agentsOfRole, bindsOfRarity } from '../logic/reroll';
import { MAPS, mapImage } from '../data/maps';
import { RoomEvent, Side, TeamRoll, TeamSlot, TEAM_INTRO_MS, TEAM_STEP_MS, MAP_SPIN_MS, type MapMode } from '../logic/room';
import { RoleIcon } from './RoleIcon';
import './room.css';

// 1人ぶんの演出の中の区切り（TEAM_STEP_MS の中で）
const FACE_STOP = 475;  // 顔のスロットが止まる
const BIND_STOP = 625;  // 縛りの文字が確定する
// 振り直しの演出の中の区切り（REROLL_MS の中で）
const REROLL_STOP = 550;

const LOGO = '/assets/CHAOS_fix.png';

export const SIDE_LABEL: Record<Side, string> = { ATK: 'ATTACKER', DEF: 'DEFENDER' };
export const ROLE_LABEL: Record<Agent['role'], string> = {
  Duelist: 'DUELIST', Initiator: 'INITIATOR', Controller: 'CONTROLLER', Sentinel: 'SENTINEL',
};
export const RARITY_COLOR: Record<Bind['rarity'], string> = {
  CHAOS: '#FF4655', Epic: '#c084fc', Exotic: '#4ade80', Unique: '#f472b6', Special: '#22d3ee', Extra: '#facc15',
};

/** 同じイベントなら、どの画面でも同じ値になる乱数 */
function rand(seed: string, n: number): number {
  let h = 2166136261 ^ n;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 抽選中に流す縛り文（同じレア度の本物の縛りを次々に見せる） */
function rollingBind(rarity: Bind['rarity'], seed: string, tick: number): string {
  const pool = bindsOfRarity(rarity);
  return pool[Math.floor(rand(seed, tick) * pool.length)]?.text ?? '';
}

/** 回っている間の表示を切り替える目安。押してから始まるまで（マイナスの時間）も止めずに回す */
const spinTick = (t: number, every: number) => Math.floor((t + 100000) / every);

/**
 * 縛り文の改行を今のカード幅に合わせて整える。
 * 元の文の区切り（※・括弧で始まる行、。！】などで終わる行）だけ残し、
 * 途中の改行はつなげて、文節の切れ目で自動的に折り返させる
 */
export function bindBlocks(text: string): string[] {
  const blocks: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const prev = blocks[blocks.length - 1];
    const startsNew = /^[※（(【[]/.test(line);
    const prevEnds = prev !== undefined && /[。！!？?】』]$/.test(prev);
    if (prev === undefined || startsNew || prevEnds) blocks.push(line);
    else blocks[blocks.length - 1] = prev + line;
  }
  return blocks;
}

/** 長い縛り文は、カードからはみ出ないよう文字を小さくする */
export function bindFontSize(text: string, base = 20): number {
  const len = text.replace(/\n/g, '').length;
  const blocks = bindBlocks(text).length;
  if (len > 70 || blocks > 4) return base - 5;
  if (len > 50 || blocks > 3) return base - 3;
  if (len > 34) return base - 2;
  return base;
}

/** 縛り文を、整えた区切りごとに表示する */
export function BindText({ text, className = '', size }: { text: string; className?: string; size: number }) {
  return (
    <p className={`cr-bindtext ${className}`} style={{ fontSize: size }}>
      {bindBlocks(text).map((b, i) => <span key={i}>{b}</span>)}
    </p>
  );
}

/** 長い名前は文字を小さくして、なるべく全部見えるようにする */
const nameFontSize = (name: string) => (name.length > 11 ? 14 : name.length > 8 ? 16 : 20);

/** 振り直しの演出中の情報（対象・経過時間） */
export interface RerollAnim { target: 'agent' | 'bind'; t: number; seed: string }

/** 1920×1080 の画面を、置き場所の大きさに合わせて縮小して表示する */
export function Stage({ children, className = '' }: { children: ReactNode; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const fit = () => setScale(Math.min(el.clientWidth / 1920, el.clientHeight / 1080));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={host} className={`cr-stage-host ${className}`}>
      <div className="cr-stage" style={{ transform: `scale(${scale})` }}>{children}</div>
    </div>
  );
}

export function RarityBadge({ rarity, size = 'md' }: { rarity: Bind['rarity']; size?: 'sm' | 'md' }) {
  return <span className={`cr-badge cr-r-${rarity} ${size === 'sm' ? 'cr-badge-sm' : ''}`}>{rarity.toUpperCase()}</span>;
}

/** 左上の見出し：ロゴ＋何の抽選か＋回した人 */
function Header({ label, tone, by, t, byLabel = '抽選' }: { label: string; tone: 'ATK' | 'DEF' | 'MAP'; by: string; t: number; byLabel?: string }) {
  const logoIn = Math.max(0, Math.min(1, t / 250));
  const tagIn = Math.max(0, Math.min(1, (t - 120) / 220));
  return (
    <div className="cr-head">
      <div className="cr-logo" style={{ opacity: logoIn, transform: `scale(${0.8 + logoIn * 0.2}) rotate(${(1 - logoIn) * -6}deg)` }}>
        <img src={LOGO} alt="CHAOSガチャ" />
      </div>
      <div className="cr-head-right" style={{ opacity: tagIn, transform: `translateX(${(1 - tagIn) * -30}px)` }}>
        <div className={`cr-tag cr-tag-${tone}`}>{label}</div>
        <div className="cr-by">{byLabel}：<b>{by}</b></div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- チーム抽選

export function TeamReveal({ roll, event, t, reroll, meId }: {
  roll: TeamRoll;
  event: Extract<RoomEvent, { kind: 'team' }>;
  t: number;
  /** 結果画面を出したまま振り直したとき、その枠だけ回す */
  reroll?: ({ index: number } & RerollAnim) | null;
  /** 見ている本人。その人のカードだけ光らせる */
  meId?: string | null;
}) {
  return (
    <div className={`cr-reveal cr-side-${roll.side}`}>
      <Header label={SIDE_LABEL[roll.side]} tone={roll.side} by={event.by} t={t} />
      <div className="cr-cards">
        {roll.slots.map((slot, i) => (
          <RevealCard key={slot.memberId} slot={slot} seed={`${event.id}:${i}`}
            local={t - TEAM_INTRO_MS - i * TEAM_STEP_MS}
            reroll={reroll?.index === i ? reroll : null} mine={!!meId && slot.memberId === meId} />
        ))}
      </div>
    </div>
  );
}

function RevealCard({ slot, seed, local, reroll, mine }: {
  slot: TeamSlot; seed: string; local: number; reroll: RerollAnim | null; mine: boolean;
}) {
  const pool = useMemo(() => agentsOfRole(slot.agent.role), [slot.agent.role]);
  const enter = Math.max(0, Math.min(1, (local + 250) / 250));
  const style = { '--rc': RARITY_COLOR[slot.bind.rarity] } as CSSProperties;

  if (local < 0) {
    return (
      <div className="cr-slot" style={{ ...style, opacity: 0.35 + enter * 0.4, transform: `translateY(${(1 - enter) * 30}px)` }}>
        <div className="cr-card cr-wait">
          <div className="cr-art cr-art-q"><span>?</span><div className="cr-pname" style={{ fontSize: nameFontSize(slot.name) }}>{slot.name}</div></div>
          <div className="cr-bind" />
        </div>
      </div>
    );
  }

  // 最初の抽選か、振り直し（対象だけもう一度回す）か
  const re = reroll && local >= BIND_STOP ? reroll : null;
  const faceSpin = re ? re.target === 'agent' && re.t < REROLL_STOP : local < FACE_STOP;
  const bindSpin = re ? re.target === 'bind' && re.t < REROLL_STOP : local < BIND_STOP;
  const faceSince = re ? (re.target === 'agent' ? re.t - REROLL_STOP : Infinity) : local - FACE_STOP;
  const bindSince = re ? (re.target === 'bind' ? re.t - REROLL_STOP : Infinity) : local - BIND_STOP;
  const spinT = re ? re.t : local;
  const spinSeed = re ? re.seed : seed;

  const face = faceSpin ? pool[Math.floor(rand(spinSeed, spinTick(spinT, 60)) * pool.length)] : slot.agent;
  const faceFlash = !faceSpin ? Math.max(0, 1 - faceSince / 250) : 0;
  const pop = !faceSpin && faceSince < 220 ? 1 + 0.05 * Math.sin((faceSince / 220) * Math.PI) : 1;
  const bindFlash = !bindSpin ? Math.max(0, 1 - bindSince / 350) : 0;
  const badgeOn = !!re || local >= 125;
  // 本人のカードは、縛りが決まったらレア度の色でふわっと光り続ける
  const glow = mine && !bindSpin;

  return (
    <div className={`cr-slot ${glow ? 'cr-glow' : ''}`} style={{ ...style, transform: `scale(${pop})` }}>
      <div className={`cr-card ${faceSpin || bindSpin ? 'cr-spinning' : ''}`}>
        <div className="cr-art">
          <img src={face.image} alt="" className={faceSpin ? 'cr-blur' : ''} />
          <div className="cr-art-fade" />
          <div className="cr-pname" style={{ fontSize: nameFontSize(slot.name) }}>{slot.name}</div>
          <div className="cr-agent">
            <span className="cr-role"><RoleIcon role={slot.agent.role} size={24} />{ROLE_LABEL[slot.agent.role]}</span>
            <span className="cr-aname">{faceSpin ? '？？？' : slot.agent.name}</span>
          </div>
          {faceFlash > 0 && <div className="cr-flash-white" style={{ opacity: faceFlash }} />}
        </div>
        <div className={`cr-bind ${badgeOn && bindSpin ? 'cr-bind-rolling' : ''} ${!bindSpin && slot.bind.rarity === 'CHAOS' ? 'cr-bind-CHAOS' : ''}`}>
          {badgeOn && <RarityBadge rarity={slot.bind.rarity} />}
          {(() => {
            const text = !bindSpin ? slot.bind.text : badgeOn ? rollingBind(slot.bind.rarity, spinSeed, spinTick(spinT, 90)) : '';
            return <BindText text={text} className={bindSpin ? 'cr-rolling' : ''} size={bindFontSize(text)} />;
          })()}
          {bindFlash > 0 && <div className="cr-bind-flash" style={{ opacity: bindFlash }} />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- マップ抽選

/** だんだん遅くなって結果で止まる、枠の移動の予定表 */
function mapSchedule(seed: string, poolSize: number, resultIndex: number) {
  const times: number[] = [];
  let at = 0;
  let step = 35;
  while (at < MAP_SPIN_MS) {
    times.push(at);
    at += step;
    step *= at < MAP_SPIN_MS * 0.45 ? 1.015 : 1.085;
  }
  const seq = times.map((_, k) => Math.floor(rand(seed, k) * poolSize));
  for (let k = 1; k < seq.length; k++) if (seq[k] === seq[k - 1]) seq[k] = (seq[k] + 1) % poolSize;
  seq[seq.length - 1] = resultIndex;
  if (poolSize > 1 && seq[seq.length - 2] === resultIndex) seq[seq.length - 2] = (resultIndex + 1) % poolSize;
  return { times, seq };
}

export function MapReveal({ event, t, mode = 'BAN', marks = [] }: {
  event: Extract<RoomEvent, { kind: 'map' }>;
  t: number;
  /** 候補を選んだときの印（候補外のマップを、選んでいたときと同じ見た目で残す） */
  mode?: MapMode;
  marks?: string[];
}) {
  const pool = useMemo(() => MAPS.filter(m => event.pool.includes(m.id)), [event.pool]);
  const resultIndex = pool.findIndex(m => m.id === event.mapId);
  const { times, seq } = useMemo(() => mapSchedule(event.id, pool.length, resultIndex), [event.id, pool.length, resultIndex]);
  let k = 0;
  while (k + 1 < times.length && times[k + 1] <= t) k++;
  const currentId = t < 0 ? null : pool[seq[k]]?.id ?? null;
  const stopped = t >= MAP_SPIN_MS;
  const winFlash = stopped ? Math.max(0, 1 - (t - MAP_SPIN_MS) / 400) : 0;

  return (
    <div className="cr-reveal cr-side-MAP">
      <Header label="MAP" tone="MAP" by={event.by} t={t} />
      <div className={`cr-maps ${stopped ? 'cr-maps-done' : ''}`}>
        {MAPS.map(m => {
          const inPool = event.pool.includes(m.id);
          const hit = m.id === currentId;
          const cls = !inPool ? 'cr-map-out' : hit ? (stopped ? 'cr-map-win' : 'cr-map-hit') : 'cr-map-cand';
          return (
            <div key={m.id} className={`cr-map cr-board ${cls}`}>
              <img src={mapImage(m)} alt="" />
              <span>{m.name}</span>
              {!inPool && mode === 'BAN' && marks.includes(m.id) && <div className="cr-map-mark cr-mark-BAN">BAN</div>}
              {hit && stopped && <div className="cr-map-pick">PICK!</div>}
              {hit && winFlash > 0 && <div className="cr-flash-white" style={{ opacity: winFlash * 0.8 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** マップのPICK/BANを話し合っている途中の画面。誰かが押すたびに全員のOBSで印が変わる */
export function MapBoard({ mode, marks, history, by }: { mode: MapMode; marks: string[]; history: string[]; by: string }) {
  return (
    <div className="cr-reveal cr-side-MAP">
      <Header label={`MAP ${mode}`} tone="MAP" by={by} t={1000} byLabel="操作" />
      <div className="cr-maps">
        {MAPS.map(m => {
          const marked = marks.includes(m.id);
          const used = history.includes(m.id);
          const out = used || (mode === 'PICK' ? !marked : marked);
          return (
            <div key={m.id} className={`cr-map cr-board ${out ? (used || mode === 'BAN' ? 'cr-map-out' : 'cr-map-unpicked') : 'cr-map-in'} ${mode === 'PICK' && marked ? 'cr-map-picked' : ''}`}>
              <img src={mapImage(m)} alt="" />
              <span>{m.name}</span>
              {used ? <div className="cr-map-mark cr-mark-used">済</div>
                : marked && mode === 'BAN' && <div className="cr-map-mark cr-mark-BAN">BAN</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 試合中に出し続けるカード

export function MyCard({ slot, side, reroll, appear = false }: {
  slot: TeamSlot;
  side: Side;
  /** 結果画面を閉じて試合開始になった瞬間の登場演出 */
  appear?: boolean;
  /** 振り直しの演出中なら、その対象と経過時間 */
  reroll?: RerollAnim | null;
}) {
  const pool = useMemo(() => agentsOfRole(slot.agent.role), [slot.agent.role]);
  const spinning = reroll && reroll.t < REROLL_STOP;
  const tick = reroll ? spinTick(reroll.t, 60) : 0;
  const face = spinning && reroll.target === 'agent' ? pool[Math.floor(rand(reroll.seed, tick) * pool.length)] : slot.agent;
  const text = spinning && reroll.target === 'bind' ? rollingBind(slot.bind.rarity, reroll.seed, spinTick(reroll.t, 90)) : slot.bind.text;
  const flash = reroll && !spinning ? Math.max(0, 1 - (reroll.t - REROLL_STOP) / 250) : 0;

  return (
    // 攻守は後半で入れ替わるので出さない。色はレア度だけ
    <div className={`cr-mine cr-mine-${side} ${appear ? 'cr-mine-appear' : ''} ${slot.bind.rarity === 'CHAOS' && !spinning ? 'cr-mine-chaos' : ''}`} style={{ '--rc': RARITY_COLOR[slot.bind.rarity] } as CSSProperties}>
      {appear && <div className="cr-mine-appear-flash" />}
      <div className="cr-mine-face">
        <img src={face.image} alt="" className={spinning && reroll.target === 'agent' ? 'cr-blur' : ''} />
      </div>
      <div className="cr-mine-txt">
        <div className="cr-mine-head">
          <span className="cr-mine-ag">{spinning && reroll.target === 'agent' ? '？？？' : slot.agent.name}</span>
          <RarityBadge rarity={slot.bind.rarity} size="sm" />
        </div>
        <BindText text={text} className={spinning && reroll.target === 'bind' ? 'cr-rolling' : ''} size={Math.max(15, bindFontSize(text, 17))} />
      </div>
      {flash > 0 && <div className="cr-flash-white" style={{ opacity: flash * 0.8 }} />}
    </div>
  );
}
