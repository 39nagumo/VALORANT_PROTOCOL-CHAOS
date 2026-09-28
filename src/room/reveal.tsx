import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Agent, Bind } from '../logic/gacha';
import { agentsOfRole, bindsOfRarity } from '../logic/reroll';
import { MAPS, mapImage } from '../data/maps';
import {
  RoomEvent, Side, TeamRoll, TeamSlot,
  TEAM_INTRO_MS, TEAM_STEP_MS, TEAM_SIZE,
  MAP_SPIN_MS,
} from '../logic/room';
import './room.css';

// 1人ぶんの演出の中の区切り（TEAM_STEP_MS の中で）
const FACE_STOP = 475;  // 顔のスロットが止まる
const BIND_STOP = 625;  // 縛りの文字が確定する
// 振り直しの演出の中の区切り（REROLL_MS の中で）
const REROLL_STOP = 550;

export const SIDE_LABEL: Record<Side, string> = { ATK: 'ATTACKER', DEF: 'DEFENDER' };
export const ROLE_LABEL: Record<Agent['role'], string> = {
  Duelist: 'DUELIST', Initiator: 'INITIATOR', Controller: 'CONTROLLER', Sentinel: 'SENTINEL',
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

// ---------------------------------------------------------------- チーム抽選

export function TeamReveal({ roll, event, t, reroll }: {
  roll: TeamRoll;
  event: Extract<RoomEvent, { kind: 'team' }>;
  t: number;
  /** 結果画面を出したまま振り直したとき、その枠だけ回す */
  reroll?: ({ index: number } & RerollAnim) | null;
}) {
  const intro = Math.max(0, Math.min(1, t / 300));
  const done = Math.max(0, Math.min(TEAM_SIZE, Math.floor((t - TEAM_INTRO_MS - BIND_STOP) / TEAM_STEP_MS) + 1));

  // CHAOSが確定した瞬間だけ、画面全体を赤く光らせる
  let chaosFlash = 0;
  roll.slots.forEach((s, i) => {
    const local = t - TEAM_INTRO_MS - i * TEAM_STEP_MS - BIND_STOP;
    if (s.bind.rarity === 'CHAOS' && local >= 0 && local < 350) chaosFlash = Math.max(chaosFlash, 1 - local / 350);
    if (reroll?.index === i && reroll.target === 'bind' && s.bind.rarity === 'CHAOS') {
      const r = reroll.t - REROLL_STOP;
      if (r >= 0 && r < 350) chaosFlash = Math.max(chaosFlash, 1 - r / 350);
    }
  });

  return (
    <div className={`cr-reveal cr-side-${roll.side}`}>
      <div className="cr-bg" />
      <div className="cr-stripes" />
      <h1 className="cr-title" style={{ opacity: intro, transform: `translateX(${(1 - intro) * -80}px) skewX(-8deg)` }}>
        MISSION PROTOCOL / {SIDE_LABEL[roll.side]}
      </h1>
      <div className="cr-sub" style={{ opacity: intro }}>5 AGENTS + CONSTRAINTS</div>
      <div className="cr-by" style={{ opacity: intro }}>抽選した人：{event.by}</div>

      <div className="cr-cards">
        {roll.slots.map((slot, i) => (
          <RevealCard key={slot.memberId} slot={slot} seed={`${event.id}:${i}`}
            local={t - TEAM_INTRO_MS - i * TEAM_STEP_MS}
            reroll={reroll?.index === i ? reroll : null} />
        ))}
      </div>

      <div className="cr-progress">
        PLAYER
        {Array.from({ length: TEAM_SIZE }, (_, i) => <i key={i} className={i < done ? 'on' : ''} />)}
      </div>
      {chaosFlash > 0 && <div className="cr-flash-red" style={{ opacity: chaosFlash * 0.55 }} />}
    </div>
  );
}

function RevealCard({ slot, seed, local, reroll }: {
  slot: TeamSlot; seed: string; local: number; reroll: RerollAnim | null;
}) {
  const pool = useMemo(() => agentsOfRole(slot.agent.role), [slot.agent.role]);
  if (local < 0) {
    return (
      <div className="cr-card cr-wait">
        <div className="cr-pname">{slot.name}</div>
        <div className="cr-aname">―</div>
        <div className="cr-role">WAITING</div>
        <div className="cr-img cr-img-q">?</div>
        <div className="cr-bind" />
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

  const tick = Math.floor(Math.max(0, spinT) / 60);
  const face = faceSpin ? pool[Math.floor(rand(spinSeed, tick) * pool.length)] : slot.agent;
  const faceFlash = !faceSpin ? Math.max(0, 1 - faceSince / 250) : 0;
  const pop = !faceSpin && faceSince < 200 ? 1 + 0.06 * (1 - faceSince / 200) : 1;
  const chaos = !bindSpin && slot.bind.rarity === 'CHAOS';
  const burstIn = chaos && bindSince < 350;
  const badgeOn = re || local >= 125;

  return (
    <div className={`cr-card ${faceSpin || bindSpin ? 'cr-spin' : 'cr-fixed'} ${chaos ? 'cr-chaos' : ''}`}
      style={{ transform: `scale(${chaos ? 1.04 : pop})` }}>
      {chaos && <div className={`cr-burst ${burstIn ? 'cr-burst-in' : ''}`}>CHAOS!!</div>}
      <div className="cr-pname">{slot.name}</div>
      <div className="cr-aname">{faceSpin ? '？？？' : slot.agent.name}</div>
      <div className={`cr-role cr-role-${slot.agent.role}`}>{ROLE_LABEL[slot.agent.role]}</div>
      <div className="cr-img">
        <img src={face.image} alt="" className={faceSpin ? 'cr-blur' : ''} />
        {faceFlash > 0 && <div className="cr-flash-white" style={{ opacity: faceFlash }} />}
      </div>
      <div className={`cr-bind ${badgeOn && bindSpin ? `cr-glow-${slot.bind.rarity}` : ''}`}>
        {badgeOn && <RarityBadge rarity={slot.bind.rarity} />}
        <p className={bindSpin ? 'cr-rolling' : ''}>
          {!bindSpin ? slot.bind.text : badgeOn ? rollingBind(slot.bind.rarity, spinSeed, Math.floor(Math.max(0, spinT) / 90)) : ''}
        </p>
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

export function MapReveal({ event, t }: { event: Extract<RoomEvent, { kind: 'map' }>; t: number }) {
  const pool = useMemo(() => MAPS.filter(m => event.pool.includes(m.id)), [event.pool]);
  const resultIndex = pool.findIndex(m => m.id === event.mapId);
  const { times, seq } = useMemo(() => mapSchedule(event.id, pool.length, resultIndex), [event.id, pool.length, resultIndex]);
  let k = 0;
  while (k + 1 < times.length && times[k + 1] <= t) k++;
  const current = t < 0 ? -1 : seq[k];
  const stopped = t >= MAP_SPIN_MS;
  const big = Math.max(0, Math.min(1, (t - MAP_SPIN_MS - 150) / 300));
  const result = pool[resultIndex];

  return (
    <div className="cr-reveal cr-side-MAP">
      <div className="cr-bg" />
      <div className="cr-stripes" />
      <h1 className="cr-title" style={{ transform: 'skewX(-8deg)' }}>MAP SELECTION</h1>
      <div className="cr-by">抽選した人：{event.by}</div>
      <div className="cr-maps" style={{ opacity: 1 - big * 0.85 }}>
        {pool.map((m, i) => (
          <div key={m.id} className={`cr-map ${i === current ? (stopped ? 'cr-map-win' : 'cr-map-hit') : ''}`}>
            <img src={mapImage(m)} alt="" />
            <span>{m.name}</span>
          </div>
        ))}
      </div>
      {big > 0 && result && (
        <div className="cr-map-big" style={{ opacity: big, transform: `translate(-50%, -50%) scale(${0.85 + big * 0.15})` }}>
          <img src={mapImage(result)} alt="" />
          <div className="cr-map-big-name">{result.name}</div>
          {big < 1 && <div className="cr-flash-white" style={{ opacity: 1 - big }} />}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 試合中に出し続けるカード

export function MyCard({ slot, side, reroll }: {
  slot: TeamSlot;
  side: Side;
  /** 振り直しの演出中なら、その対象と経過時間 */
  reroll?: RerollAnim | null;
}) {
  const pool = useMemo(() => agentsOfRole(slot.agent.role), [slot.agent.role]);
  const spinning = reroll && reroll.t < REROLL_STOP;
  const tick = reroll ? Math.floor(Math.max(0, reroll.t) / 60) : 0;
  const face = spinning && reroll.target === 'agent' ? pool[Math.floor(rand(reroll.seed, tick) * pool.length)] : slot.agent;
  const text = spinning && reroll.target === 'bind' ? rollingBind(slot.bind.rarity, reroll.seed, Math.floor(reroll.t / 90)) : slot.bind.text;
  const flash = reroll && !spinning ? Math.max(0, 1 - (reroll.t - REROLL_STOP) / 250) : 0;

  return (
    // 攻守は後半で入れ替わるので文字では出さず、左の色だけで最初の陣営を示す
    <div className={`cr-mine cr-mine-${side} ${slot.bind.rarity === 'CHAOS' ? 'cr-mine-chaos' : ''}`}>
      <div className="cr-mine-face">
        <img src={face.image} alt="" className={spinning && reroll.target === 'agent' ? 'cr-blur' : ''} />
      </div>
      <div className="cr-mine-txt">
        <div className="cr-mine-who">{slot.name}</div>
        <div className="cr-mine-ag">{spinning && reroll.target === 'agent' ? '？？？' : slot.agent.name}</div>
        <RarityBadge rarity={slot.bind.rarity} size="sm" />
        <p className={spinning && reroll.target === 'bind' ? 'cr-rolling' : ''}>{text}</p>
      </div>
      {flash > 0 && <div className="cr-flash-white" style={{ opacity: flash * 0.8 }} />}
    </div>
  );
}
