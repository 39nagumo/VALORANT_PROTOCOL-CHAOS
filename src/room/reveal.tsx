import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Agent, Bind } from '../logic/gacha';
import { agentsOfRole } from '../logic/reroll';
import { MAPS, mapImage } from '../data/maps';
import {
  RoomEvent, Side, TeamRoll, TeamSlot,
  TEAM_INTRO_MS, TEAM_STEP_MS, TEAM_REVEAL_MS, TEAM_OUT_MS, TEAM_SIZE,
  MAP_SPIN_MS, MAP_REVEAL_MS, REROLL_MS,
} from '../logic/room';
import './room.css';

// 1人ぶんの演出の中の区切り（TEAM_STEP_MS の中で）
const FACE_STOP = 950;   // 顔のスロットが止まる
const BIND_STOP = 1250;  // 縛りの文字が確定する

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

const SCRAMBLE = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン縛撃弾走跳叫';
function scramble(text: string, seed: string, tick: number): string {
  return Array.from(text, (c, i) => (c === '\n' || c === ' ' ? c : SCRAMBLE[Math.floor(rand(seed, tick * 97 + i) * SCRAMBLE.length)])).join('');
}

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

export function TeamReveal({ roll, event, t }: {
  roll: TeamRoll;
  event: Extract<RoomEvent, { kind: 'team' }>;
  t: number;
}) {
  const out = Math.max(0, Math.min(1, (t - (TEAM_REVEAL_MS - TEAM_OUT_MS)) / TEAM_OUT_MS));
  const intro = Math.max(0, Math.min(1, t / 600));
  const done = Math.max(0, Math.min(TEAM_SIZE, Math.floor((t - TEAM_INTRO_MS - BIND_STOP) / TEAM_STEP_MS) + 1));

  // CHAOSが確定した瞬間だけ、画面全体を赤く光らせる
  let chaosFlash = 0;
  roll.slots.forEach((s, i) => {
    const local = t - TEAM_INTRO_MS - i * TEAM_STEP_MS - BIND_STOP;
    if (s.bind.rarity === 'CHAOS' && local >= 0 && local < 500) chaosFlash = Math.max(chaosFlash, 1 - local / 500);
  });

  return (
    <div className={`cr-reveal cr-side-${roll.side}`} style={{ opacity: 1 - out }}>
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
            local={t - TEAM_INTRO_MS - i * TEAM_STEP_MS} />
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

function RevealCard({ slot, seed, local }: { slot: TeamSlot; seed: string; local: number }) {
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
  const faceFixed = local >= FACE_STOP;
  const bindFixed = local >= BIND_STOP;
  const tick = Math.floor(local / 70);
  const face = faceFixed ? slot.agent : pool[Math.floor(rand(seed, tick) * pool.length)];
  const faceFlash = faceFixed ? Math.max(0, 1 - (local - FACE_STOP) / 300) : 0;
  const pop = faceFixed && local < FACE_STOP + 250 ? 1 + 0.06 * (1 - (local - FACE_STOP) / 250) : 1;
  const chaos = bindFixed && slot.bind.rarity === 'CHAOS';
  const badgeOn = local >= 250;

  return (
    <div className={`cr-card ${faceFixed ? 'cr-fixed' : 'cr-spin'} ${chaos ? 'cr-chaos' : ''}`}
      style={{ transform: `scale(${chaos ? 1.04 : pop})` }}>
      {chaos && <div className="cr-burst">CHAOS!!</div>}
      <div className="cr-pname">{slot.name}</div>
      <div className="cr-aname">{faceFixed ? slot.agent.name : '？？？'}</div>
      <div className={`cr-role cr-role-${slot.agent.role}`}>{ROLE_LABEL[slot.agent.role]}</div>
      <div className="cr-img">
        <img src={face.image} alt="" className={faceFixed ? '' : 'cr-blur'} />
        {faceFlash > 0 && <div className="cr-flash-white" style={{ opacity: faceFlash }} />}
      </div>
      <div className={`cr-bind ${badgeOn && !bindFixed ? `cr-glow-${slot.bind.rarity}` : ''}`}>
        {badgeOn && <RarityBadge rarity={slot.bind.rarity} />}
        <p className={bindFixed ? '' : 'cr-scramble'}>
          {bindFixed ? slot.bind.text : badgeOn ? scramble(slot.bind.text.split('\n').slice(0, 2).join('\n'), seed, Math.floor(local / 60)) : ''}
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
  let step = 55;
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
  const big = Math.max(0, Math.min(1, (t - MAP_SPIN_MS - 300) / 450));
  const out = Math.max(0, Math.min(1, (t - (MAP_REVEAL_MS - 600)) / 600));
  const result = pool[resultIndex];

  return (
    <div className="cr-reveal cr-side-MAP" style={{ opacity: 1 - out }}>
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
  reroll?: { target: 'agent' | 'bind'; t: number; seed: string } | null;
}) {
  const pool = useMemo(() => agentsOfRole(slot.agent.role), [slot.agent.role]);
  const spinning = reroll && reroll.t < REROLL_MS * 0.7;
  const tick = reroll ? Math.floor(Math.max(0, reroll.t) / 70) : 0;
  const face = spinning && reroll.target === 'agent' ? pool[Math.floor(rand(reroll.seed, tick) * pool.length)] : slot.agent;
  const text = spinning && reroll.target === 'bind' ? scramble(slot.bind.text, reroll.seed, tick) : slot.bind.text;
  const flash = reroll && !spinning ? Math.max(0, 1 - (reroll.t - REROLL_MS * 0.7) / 400) : 0;

  return (
    <div className={`cr-mine cr-mine-${side} ${slot.bind.rarity === 'CHAOS' ? 'cr-mine-chaos' : ''}`}>
      <div className="cr-mine-face">
        <img src={face.image} alt="" className={spinning && reroll.target === 'agent' ? 'cr-blur' : ''} />
      </div>
      <div className="cr-mine-txt">
        <div className="cr-mine-top">
          <span className="cr-mine-who">{slot.name}</span>
          <span className="cr-mine-side">{SIDE_LABEL[side]}</span>
        </div>
        <div className="cr-mine-ag">{spinning && reroll.target === 'agent' ? '？？？' : slot.agent.name}</div>
        <RarityBadge rarity={slot.bind.rarity} size="sm" />
        <p className={spinning && reroll.target === 'bind' ? 'cr-scramble' : ''}>{text}</p>
      </div>
      {flash > 0 && <div className="cr-flash-white" style={{ opacity: flash * 0.8 }} />}
    </div>
  );
}
