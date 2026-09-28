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
}

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

export interface RoomState {
  members: Member[];
  teams: { ATK: TeamRoll | null; DEF: TeamRoll | null };
  map: string | null;
  /** PICK＝印を付けたマップから選ぶ／BAN＝印を付けたマップを除いて選ぶ（元のマップ抽選と同じ） */
  mapMode: MapMode;
  mapMarks: string[];
  mapHistory: string[];
  event: RoomEvent | null;
  /** OBSに出し続けている抽選結果の画面（誰かが閉じるまで残る） */
  display: Extract<RoomEvent, { kind: 'team' | 'map' }> | null;
  lockUntil: number;
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
  | { type: 'join'; uid: string; name: string }
  | { type: 'seat'; memberId: string; seat: Seat }
  | { type: 'randomTeams' }
  | { type: 'roll'; side: Side }
  | { type: 'reroll'; side: Side; index: number; target: 'agent' | 'bind' }
  | { type: 'mapMode'; mode: MapMode }
  | { type: 'mapMark'; mapId: string }
  | { type: 'mapRoll' }
  | { type: 'mapClearHistory' }
  | { type: 'closeDisplay' }
  | { type: 'newMatch' }
  | { type: 'regenerate' };

export type ServerMessage =
  | { type: 'state'; state: RoomState; now: number }
  | { type: 'joined'; memberId: string }
  | { type: 'error'; message: string }
  | { type: 'moved'; roomId: string }
  | { type: 'closed' };

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
