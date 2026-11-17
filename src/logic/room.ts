// ルーム（みんなで同じ抽選結果を見る機能）の、サーバーと画面で共通の型と定数
import type { Agent, Bind, BindRarity } from './gacha';

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
  bindPick?: BindRarity | null;   // 縛りのレア度の指定（抽選ではこのレア度から引く）
  extraRarity?: BindRarity | null; // 2つ目の縛りのレア度（任意）
}

/** 縛りのレア度（指定や2つ目の縛りで選べるもの） */
export const BIND_RARITIES: BindRarity[] = ['CHAOS', 'Epic', 'Exotic', 'Unique', 'Special', 'Extra'];
export const isBindRarity = (v: unknown): v is BindRarity => BIND_RARITIES.includes(v as BindRarity);

/**
 * ランクと点数（2026-11-17 いったん決めた値。上の段ほど大きく上がる）。
 * 点数はチーム分けの目安にだけ使う。変えるときはここだけ直す
 */
export const RANKS = [
  // color＝公式のランクの紋章の色を目安にした札の地の色、ink＝その上の文字の色、fg＝暗い地の上で文字として使う色
  { id: 'iron', label: 'アイアン', points: 1, color: '#7a7a7a', ink: '#ffffff', fg: '#a8a8a8' },
  { id: 'bronze', label: 'ブロンズ', points: 2, color: '#a5774a', ink: '#ffffff', fg: '#d29a63' },
  { id: 'silver', label: 'シルバー', points: 3, color: '#c8d0d2', ink: '#1b1f24', fg: '#dfe6e8' },
  { id: 'gold', label: 'ゴールド', points: 5, color: '#e6b84a', ink: '#1b1f24', fg: '#f0c45a' },
  { id: 'platinum', label: 'プラチナ', points: 7, color: '#36b3c4', ink: '#0b1a1d', fg: '#4fd0e0' },
  { id: 'diamond', label: 'ダイヤモンド', points: 10, color: '#b77fe0', ink: '#ffffff', fg: '#c99af0' },
  { id: 'ascendant', label: 'アセンダント', points: 13, color: '#2fb576', ink: '#ffffff', fg: '#3fd28c' },
  { id: 'immortal', label: 'イモータル', points: 17, color: '#c8394f', ink: '#ffffff', fg: '#ff5a72' },
  { id: 'radiant', label: 'レディアント', points: 22, color: '#fff1b8', ink: '#5a4300', fg: '#fff1b8' },
] as const;
export type RankId = typeof RANKS[number]['id'];
/** ランクを選んでいない人は、この点数として数える（ゴールド相当） */
export const UNRANKED_POINTS = 5;
/** チーム分けの候補にする「釣り合いの段」の数（いちばん釣り合う差、その次に近い差、…） */
export const BALANCE_LEVELS = 2;
/** 候補がこれより少ないときは、もう1段先の差まで広げる（同じ編成ばかりにならないように） */
export const BALANCE_MIN_CHOICES = 6;
/**
 * 「いちばん小さい差」より、この点数を超えて開く分け方は選ばない。
 * 点数が大きく離れた10人（どう分けても10点以上の差が出るなど）でも、いちばん差の小さい分け方を基準にする
 */
export const BALANCE_MAX_EXTRA = 4;

export const isRankId = (v: unknown): v is RankId => RANKS.some(r => r.id === v);
export const rankOf = (id: RankId | null | undefined) => RANKS.find(r => r.id === id) ?? null;
export const rankPoints = (id: RankId | null | undefined) => rankOf(id)?.points ?? UNRANKED_POINTS;

/**
 * 10人を5人ずつに分ける（返り値は [ATK, DEF]）。
 * 合計点の差が「いちばん小さい差」と「その次に小さい差」の分け方を候補にして、その中からランダムに選ぶ。
 * 候補が少なければもう1段広げる。ただし「どう分けても出るいちばん小さい差 + BALANCE_MAX_EXTRA」を超える分け方は選ばない。
 * 今の組み合わせ（isNowAtk）と同じ分け方は、ほかに候補がある限り選ばない。
 * 同じ点数の人どうしは入れ替わっても差が変わらないので、自然に入れ替わる
 */
export function balancedSplit<T>(players: T[], points: (p: T) => number, isNowAtk?: (p: T) => boolean, random = Math.random): [T[], T[]] {
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
  // 今の組み合わせ（左右どちらでも同じ）を外す
  let nowMask = -1;
  if (isNowAtk) {
    let m = 0; players.forEach((p, i) => { if (isNowAtk(p)) m |= 1 << i; });
    if (!(m & 1)) m = ((1 << n) - 1) & ~m;
    nowMask = m;
  }
  // どう分けても出る、いちばん小さい差（今の組み合わせも含めて数える）
  const best = Math.min(...splits.map(sp => sp.diff));
  const cap = best + BALANCE_MAX_EXTRA;
  const usable = splits.filter(sp => sp.mask !== nowMask && sp.diff <= cap);
  let ok: typeof splits;
  if (!usable.length) {
    // 差を広げずに入れ替えられる分け方が無ければ、いちばん小さい差の分け方（今と同じでも）にする
    ok = splits.filter(sp => sp.diff === best);
  } else {
    const levels = [...new Set(usable.map(sp => sp.diff))].sort((a, b) => a - b);
    let k = Math.min(BALANCE_LEVELS, levels.length);
    ok = usable.filter(sp => sp.diff <= levels[k - 1]);
    while (ok.length < BALANCE_MIN_CHOICES && k < levels.length) { k++; ok = usable.filter(sp => sp.diff <= levels[k - 1]); }
  }
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
  /** 2つ目の縛り（任意） */
  extra?: Bind | null;
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
  | { type: 'kick'; memberId: string }
  | { type: 'bindPick'; memberId: string; rarity: BindRarity | null }
  | { type: 'extraBind'; memberId: string; rarity: BindRarity | null }
  | { type: 'rerollExtra'; side: Side; index: number };

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
