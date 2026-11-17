// ルーム（みんなで同じ抽選結果を見る機能）の、サーバーと画面で共通の型と定数
import type { Agent, Bind } from './gacha';

export type Side = 'ATK' | 'DEF';
export type Seat = Side | 'WATCH';
export type MapMode = 'PICK' | 'BAN';

export const TEAM_SIZE = 5;

export interface Member {
  id: string;        // 公開用ID（OBS用URLの英数字とは別物）
  name: string;
  seat: Seat;
  online: boolean;   // OBSの表示を開いているか
  rank?: RankId | null; // 自己申告の最高ランク（チーム分けの目安）
}

/**
 * ランクと点数（2026-11-17 いったん決めた値。上の段ほど大きく上がる）。
 * 点数はチーム分けの目安にだけ使う。変えるときはここだけ直す
 */
export const RANKS = [
  { id: 'iron', label: 'アイアン', points: 1 },
  { id: 'bronze', label: 'ブロンズ', points: 2 },
  { id: 'silver', label: 'シルバー', points: 3 },
  { id: 'gold', label: 'ゴールド', points: 5 },
  { id: 'platinum', label: 'プラチナ', points: 7 },
  { id: 'diamond', label: 'ダイヤモンド', points: 10 },
  { id: 'ascendant', label: 'アセンダント', points: 13 },
  { id: 'immortal', label: 'イモータル', points: 17 },
  { id: 'radiant', label: 'レディアント', points: 22 },
] as const;
export type RankId = typeof RANKS[number]['id'];
/** ランクを選んでいない人は、この点数として数える（ゴールド相当） */
export const UNRANKED_POINTS = 5;
/** 合計の差がいちばん小さい分け方から、この点数までの差なら同じくらい公平とみなして、その中から選ぶ */
export const BALANCE_SLACK = 2;

export const isRankId = (v: unknown): v is RankId => RANKS.some(r => r.id === v);
export const rankOf = (id: RankId | null | undefined) => RANKS.find(r => r.id === id) ?? null;
export const rankPoints = (id: RankId | null | undefined) => rankOf(id)?.points ?? UNRANKED_POINTS;

/**
 * 10人を5人ずつに分ける。合計点の差がなるべく小さい分け方のうち、
 * 差が「いちばん小さい差 + BALANCE_SLACK」以内のものから1つを選ぶ（毎回同じ組み合わせにならないように）。
 * 返り値は [ATK, DEF]。人数が10人でなければ、そのまま半分に切る
 */
export function balancedSplit<T>(players: T[], points: (p: T) => number, random = Math.random): [T[], T[]] {
  const n = players.length;
  if (n !== TEAM_SIZE * 2) return [players.slice(0, TEAM_SIZE), players.slice(TEAM_SIZE)];
  const pts = players.map(points);
  const total = pts.reduce((a, b) => a + b, 0);
  const splits: { mask: number; diff: number }[] = [];
  // 1人目は必ず片方に入れて、左右を入れ替えただけの重複を数えない（126通り）
  for (let mask = 1; mask < 1 << n; mask += 2) {
    let cnt = 0, sum = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) { cnt++; sum += pts[i]; }
    if (cnt === TEAM_SIZE) splits.push({ mask, diff: Math.abs(total - 2 * sum) });
  }
  const best = Math.min(...splits.map(s => s.diff));
  const ok = splits.filter(s => s.diff <= best + BALANCE_SLACK);
  const pick = ok[Math.floor(random() * ok.length)].mask;
  const a = players.filter((_, i) => pick & (1 << i));
  const b = players.filter((_, i) => !(pick & (1 << i)));
  return random() < 0.5 ? [a, b] : [b, a];
}

export const teamPoints = (members: Pick<Member, 'rank'>[]) => members.reduce((s, m) => s + rankPoints(m.rank), 0);

export interface TeamSlot {
  memberId: string;
  name: string;
  agent: Agent;
  bind: Bind;
}

export interface TeamRoll {
  side: Side;
  slots: TeamSlot[];
}

/** 全員の画面で同時に流す演出。startedAt はサーバー時刻 */
export type RoomEvent =
  | { kind: 'team'; id: string; side: Side; startedAt: number; by: string }
  | { kind: 'reroll'; id: string; side: Side; index: number; target: 'agent' | 'bind'; startedAt: number; by: string }
  | { kind: 'map'; id: string; mapId: string; pool: string[]; startedAt: number; by: string };

/** マップのPICK/BANを話し合っている途中の画面（印の状態をそのまま映す） */
export interface MapSetupDisplay { kind: 'mapSetup'; id: string; startedAt: number; by: string }
export type RoomDisplay = Extract<RoomEvent, { kind: 'team' | 'map' }> | MapSetupDisplay;

export interface RoomState {
  members: Member[];
  teams: { ATK: TeamRoll | null; DEF: TeamRoll | null };
  map: string | null;
  /** PICK＝印を付けたマップから選ぶ／BAN＝印を付けたマップを除いて選ぶ（元のマップ抽選と同じ） */
  mapMode: MapMode;
  mapMarks: string[];
  mapHistory: string[];
  event: RoomEvent | null;
  /** OBSに出し続けている画面（抽選結果か、マップ選びの途中）。誰かが閉じるまで残る */
  display: RoomDisplay | null;
  lockUntil: number;
  /** ルームの主（最初に参加した人＝作った人）の公開ID。主だけが人を名簿から外せる */
  owner?: string | null;
}

// 演出の長さ（ミリ秒）。サーバーはこの間ほかの抽選を受け付けない
export const TEAM_INTRO_MS = 450;
export const TEAM_STEP_MS = 750;
export const TEAM_REVEAL_MS = TEAM_INTRO_MS + TEAM_STEP_MS * TEAM_SIZE + 300;
export const REROLL_MS = 800;
export const MAP_SPIN_MS = 2100;
export const MAP_REVEAL_MS = MAP_SPIN_MS + 700;
/** 押してから演出が始まるまでの余裕（全員に届くのを待つ） */
export const EVENT_LEAD_MS = 400;

export const eventDuration = (e: RoomEvent) =>
  e.kind === 'team' ? TEAM_REVEAL_MS : e.kind === 'map' ? MAP_REVEAL_MS : REROLL_MS;

export type ClientMessage =
  | { type: 'join'; uid: string; name: string; rank?: RankId | null }
  | { type: 'seat'; memberId: string; seat: Seat }
  | { type: 'randomTeams' }
  | { type: 'roll'; side: Side }
  | { type: 'reroll'; side: Side; index: number; target: 'agent' | 'bind' }
  | { type: 'mapMode'; mode: MapMode }
  | { type: 'mapMark'; mapId: string }
  | { type: 'mapRoll' }
  | { type: 'showMapSetup' }
  | { type: 'mapClearHistory' }
  | { type: 'closeDisplay' }
  | { type: 'newMatch' }
  | { type: 'regenerate' }
  | { type: 'leave' }
  | { type: 'kick'; memberId: string };

export type ServerMessage =
  | { type: 'state'; state: RoomState; now: number }
  | { type: 'joined'; memberId: string }
  | { type: 'error'; message: string }
  | { type: 'moved'; roomId: string }
  | { type: 'closed' }
  | { type: 'left'; kicked: boolean };

/** ブラウザ（またはOBS）ごとの秘密のID。OBS用URLの末尾になる */
export const UID_PATTERN = /^[a-z0-9]{16,40}$/;
export const ROOM_PATTERN = /^[a-z0-9]{6,16}$/;
export const NAME_MAX = 16;

/** 次に回すマップの候補（一度出たマップは外す） */
export function mapPool(allIds: string[], s: Pick<RoomState, 'mapMode' | 'mapMarks' | 'mapHistory'>): string[] {
  const marks = s.mapMarks ?? [];
  const base = s.mapMode === 'PICK' ? allIds.filter(id => marks.includes(id)) : allIds.filter(id => !marks.includes(id));
  return base.filter(id => !(s.mapHistory ?? []).includes(id));
}
