import { DurableObject } from 'cloudflare:workers';
import { GachaSystem } from '../../src/logic/gacha';
import { rerollAgent, rerollBind } from '../../src/logic/reroll';
import { MAPS } from '../../src/data/maps';
import {
  ClientMessage, Member, RoomEvent, RoomState, ServerMessage, Side, TeamRoll,
  TEAM_SIZE, EVENT_LEAD_MS, eventDuration,
  UID_PATTERN, ROOM_PATTERN, NAME_MAX,
} from '../../src/logic/room';

export interface Env {
  ROOM: DurableObjectNamespace<Room>;
  USER: DurableObjectNamespace<UserHub>;
  ALLOWED_ORIGINS: string;
}

// 使い終わったルームは、最後の操作からこの時間で自動的に消える
const ROOM_TTL_MS = 3 * 24 * 60 * 60 * 1000;

const ROOM_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
function newRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, b => ROOM_CHARS[b % ROOM_CHARS.length]).join('');
}

/** OBS用の秘密IDから、名簿に載せる公開IDを作る（逆算はできない） */
async function publicIdOf(uid: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(uid));
  return Array.from(new Uint8Array(digest).slice(0, 6), b => b.toString(16).padStart(2, '0')).join('');
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const emptyState = (): RoomState => ({
  members: [],
  teams: { ATK: null, DEF: null },
  map: null,
  mapBans: [],
  mapHistory: [],
  event: null,
  display: null,
  lockUntil: 0,
});

type Attachment = { as: 'page' | 'overlay'; uid: string; memberId: string | null };

class UserError extends Error {}

export class Room extends DurableObject<Env> {
  private state: RoomState | null = null;
  private secrets: Record<string, string> = {}; // 公開ID → 秘密ID（名簿の移し替え用。外には出さない）
  private closed = false;
  private roomId = '';

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.state = (await ctx.storage.get<RoomState>('state')) ?? null;
      this.secrets = (await ctx.storage.get<Record<string, string>>('secrets')) ?? {};
      this.closed = (await ctx.storage.get<boolean>('closed')) ?? false;
      this.roomId = (await ctx.storage.get<string>('roomId')) ?? '';
    });
  }

  /** 新しいルームとして使い始める（名簿の移し替え時は中身を引き継ぐ） */
  async init(roomId: string, from?: { state: RoomState; secrets: Record<string, string> }): Promise<void> {
    this.roomId = roomId;
    this.state = from?.state ?? emptyState();
    this.secrets = from?.secrets ?? {};
    this.ctx.storage.put({ roomId, state: this.state, secrets: this.secrets });
    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
  }

  async alarm(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'expired');
    await this.ctx.storage.deleteAll();
    this.state = null;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const uid = url.searchParams.get('uid') ?? '';
    const as = url.searchParams.get('as') === 'overlay' ? 'overlay' : 'page';
    if (!UID_PATTERN.test(uid)) return new Response('bad uid', { status: 400 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [as]);

    if (!this.state || this.closed) {
      this.sendTo(server, { type: 'closed' });
      server.close(1000, 'closed');
      return new Response(null, { status: 101, webSocket: client });
    }

    // 以前このルームに参加していれば、その人として扱う
    const memberId = await publicIdOf(uid);
    const known = this.secrets[memberId] === uid ? memberId : null;
    server.serializeAttachment({ as, uid, memberId: known } satisfies Attachment);
    if (known) this.sendTo(server, { type: 'joined', memberId: known });
    this.sendTo(server, this.snapshot());
    if (as === 'overlay') this.broadcast(); // オンライン表示を更新
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (!this.state || this.closed) return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
    } catch {
      return;
    }
    const att = ws.deserializeAttachment() as Attachment;
    try {
      if (msg.type === 'join') {
        await this.join(ws, att, msg.name);
      } else {
        if (att.as !== 'page' || !att.memberId) throw new UserError('先にルームへ参加してください');
        const me = this.state.members.find(m => m.id === att.memberId);
        if (!me) throw new UserError('名簿に見つかりません。参加し直してください');
        await this.handle(msg, me.name);
      }
    } catch (e) {
      if (e instanceof UserError) this.sendTo(ws, { type: 'error', message: e.message });
      else throw e;
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    try { ws.close(); } catch { /* 既に閉じている */ }
    if (att?.as === 'overlay') this.broadcast(ws);
  }

  private async join(ws: WebSocket, att: Attachment, rawName: string) {
    const s = this.state!;
    const name = String(rawName ?? '').trim().slice(0, NAME_MAX);
    if (!name) throw new UserError('名前を入力してください');
    const memberId = await publicIdOf(att.uid);
    const sameName = s.members.find(m => m.name === name && m.id !== memberId);
    if (sameName) throw new UserError(`「${name}」は既に名簿にいます。別の名前にしてください`);

    const existing = s.members.find(m => m.id === memberId);
    if (existing) {
      existing.name = name;
      for (const side of ['ATK', 'DEF'] as Side[]) {
        s.teams[side]?.slots.forEach(slot => { if (slot.memberId === memberId) slot.name = name; });
      }
    } else {
      s.members.push({ id: memberId, name, seat: 'WATCH', online: false });
    }
    this.secrets[memberId] = att.uid;
    ws.serializeAttachment({ ...att, memberId } satisfies Attachment);
    // この人のOBSを、このルームに切り替える
    await this.env.USER.getByName(att.uid).setRoom(this.roomId);
    this.sendTo(ws, { type: 'joined', memberId });
    this.save();
  }

  private async handle(msg: Exclude<ClientMessage, { type: 'join' }>, by: string) {
    const s = this.state!;
    const now = Date.now();
    const busy = () => {
      if (now < s.lockUntil) throw new UserError(`${s.event?.by ?? '誰か'}さんの抽選の演出中です`);
    };

    switch (msg.type) {
      case 'seat': {
        const m = s.members.find(x => x.id === msg.memberId);
        if (!m) throw new UserError('名簿に見つかりません');
        if (msg.seat !== 'WATCH' && msg.seat !== m.seat &&
            s.members.filter(x => x.seat === msg.seat).length >= TEAM_SIZE) {
          throw new UserError(`${msg.seat === 'ATK' ? 'ATTACKER' : 'DEFENDER'}は既に${TEAM_SIZE}人います`);
        }
        m.seat = msg.seat;
        break;
      }
      case 'randomTeams': {
        // 今チームにいる人を優先し、足りなければOBSを開いている人→それ以外の順に補う
        const seated = s.members.filter(m => m.seat !== 'WATCH');
        const rest = s.members.filter(m => m.seat === 'WATCH');
        const fill = [...shuffle(rest.filter(m => m.online)), ...shuffle(rest.filter(m => !m.online))];
        const players = shuffle([...seated, ...fill].slice(0, TEAM_SIZE * 2));
        s.members.forEach(m => { m.seat = 'WATCH'; });
        players.forEach((m, i) => { m.seat = i < TEAM_SIZE ? 'ATK' : 'DEF'; });
        break;
      }
      case 'roll': {
        busy();
        const players = s.members.filter(m => m.seat === msg.side);
        if (players.length !== TEAM_SIZE) throw new UserError(`${TEAM_SIZE}人そろってから回してください（今${players.length}人）`);
        const res = new GachaSystem().runGacha(players.map(p => p.name));
        s.teams[msg.side] = {
          side: msg.side,
          slots: players.map((p, i) => ({ memberId: p.id, name: p.name, agent: res.players[i].agent, bind: res.binds[i] })),
        };
        this.startEvent({ kind: 'team', id: crypto.randomUUID(), side: msg.side, startedAt: now + EVENT_LEAD_MS, by });
        break;
      }
      case 'reroll': {
        busy();
        const team: TeamRoll | null = s.teams[msg.side];
        const slot = team?.slots[msg.index];
        if (!team || !slot) throw new UserError('まだ抽選されていません');
        const others = team.slots.filter((_, i) => i !== msg.index);
        if (msg.target === 'agent') {
          const next = rerollAgent(slot.agent, others.map(o => o.agent));
          if (!next) throw new UserError('ほかに候補がありません');
          slot.agent = next;
        } else {
          const next = rerollBind(slot.bind, others.map(o => o.bind));
          if (!next) throw new UserError('ほかに候補がありません');
          slot.bind = next;
        }
        this.startEvent({ kind: 'reroll', id: crypto.randomUUID(), side: msg.side, index: msg.index, target: msg.target, startedAt: now + EVENT_LEAD_MS, by });
        break;
      }
      case 'mapBan': {
        if (!MAPS.some(m => m.id === msg.mapId)) return;
        s.mapBans = s.mapBans.includes(msg.mapId) ? s.mapBans.filter(id => id !== msg.mapId) : [...s.mapBans, msg.mapId];
        break;
      }
      case 'mapRoll': {
        busy();
        const pool = MAPS.map(m => m.id).filter(id => !s.mapBans.includes(id) && !s.mapHistory.includes(id));
        if (pool.length === 0) throw new UserError('候補のマップがありません。除外か履歴を外してください');
        const mapId = pool[Math.floor(Math.random() * pool.length)];
        s.map = mapId;
        s.mapHistory = [...s.mapHistory, mapId];
        this.startEvent({ kind: 'map', id: crypto.randomUUID(), mapId, pool, startedAt: now + EVENT_LEAD_MS, by });
        break;
      }
      case 'closeDisplay':
        s.display = null;
        break;
      case 'mapClearHistory':
        s.mapHistory = [];
        break;
      case 'newMatch':
        s.teams = { ATK: null, DEF: null };
        s.map = null;
        s.event = null;
        s.display = null;
        s.lockUntil = 0;
        break;
      case 'regenerate':
        await this.regenerate();
        return;
    }
    this.save();
  }

  private startEvent(e: RoomEvent) {
    const s = this.state!;
    s.event = e;
    if (e.kind !== 'reroll') s.display = e;
    // 振り直しは、結果画面が出ていればその画面の中で見せる
    else if (s.display) {
      if (s.display.kind !== 'team' || s.display.side !== e.side) {
        // 別の画面が出ていたら、そのチームの結果画面（演出なし）に切り替える
        s.display = { kind: 'team', id: crypto.randomUUID(), side: e.side, startedAt: 0, by: e.by };
      }
    }
    this.state!.lockUntil = e.startedAt + eventDuration(e);
  }

  /** URLが漏れたときの作り直し：名簿と結果を新しいルームへ移し、このルームは閉じる */
  private async regenerate() {
    const nextId = newRoomId();
    await this.env.ROOM.getByName(nextId).init(nextId, { state: { ...this.state!, event: null, lockUntil: 0 }, secrets: this.secrets });
    await Promise.all(Object.values(this.secrets).map(uid => this.env.USER.getByName(uid).setRoom(nextId, this.roomId)));
    // 開いている人は新しいルームへ移動させる（閉じた後にこのURLを開いた人には移動先を教えない）
    for (const ws of this.ctx.getWebSockets()) {
      this.sendTo(ws, { type: 'moved', roomId: nextId });
      ws.close(1000, 'moved');
    }
    this.closed = true;
    this.state = null;
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.put('closed', true);
    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
  }

  private save() {
    this.ctx.storage.put({ state: this.state, secrets: this.secrets });
    this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
    this.broadcast();
  }

  /** closing: 今まさに閉じた接続（まだ一覧に残っていることがあるので数えない） */
  private snapshot(closing?: WebSocket): ServerMessage {
    const s = this.state!;
    const online = new Set(
      this.ctx.getWebSockets('overlay').filter(ws => ws !== closing).map(ws => (ws.deserializeAttachment() as Attachment | null)?.uid)
    );
    const members: Member[] = s.members.map(m => ({ ...m, online: online.has(this.secrets[m.id]) }));
    return { type: 'state', state: { ...s, members }, now: Date.now() };
  }

  private broadcast(closing?: WebSocket) {
    if (!this.state) return;
    const msg = this.snapshot(closing);
    for (const ws of this.ctx.getWebSockets()) if (ws !== closing) this.sendTo(ws, msg);
  }

  private sendTo(ws: WebSocket, msg: ServerMessage) {
    try { ws.send(JSON.stringify(msg)); } catch { /* 切断済み */ }
  }
}

/** 1人（1つのOBS用URL）ごとの「今どのルームにいるか」。OBSの表示はここを見て自動で切り替わる */
export class UserHub extends DurableObject<Env> {
  async setRoom(roomId: string, onlyIf?: string): Promise<void> {
    if (onlyIf !== undefined && (await this.ctx.storage.get<string>('room')) !== onlyIf) return;
    await this.ctx.storage.put('room', roomId);
    for (const ws of this.ctx.getWebSockets()) ws.send(JSON.stringify({ type: 'room', roomId }));
  }

  async fetch(): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({ type: 'room', roomId: (await this.ctx.storage.get<string>('room')) ?? null }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(): Promise<void> {}

  async webSocketClose(ws: WebSocket): Promise<void> {
    try { ws.close(); } catch { /* 既に閉じている */ }
  }
}

function cors(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map(s => s.trim());
  return allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {};
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean); // ['rs', ...]
    if (parts[0] !== 'rs') return new Response('not found', { status: 404 });

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { ...cors(request, env), 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
    }

    // POST /rs/rooms → 新しいルームを作る
    if (parts[1] === 'rooms' && parts.length === 2 && request.method === 'POST') {
      const roomId = newRoomId();
      await env.ROOM.getByName(roomId).init(roomId);
      return Response.json({ roomId }, { headers: cors(request, env) });
    }

    const isWs = request.headers.get('Upgrade') === 'websocket';
    // GET /rs/room/:id?uid=...&as=page|overlay
    if (parts[1] === 'room' && parts[2] && isWs) {
      if (!ROOM_PATTERN.test(parts[2])) return new Response('bad room', { status: 400 });
      return env.ROOM.getByName(parts[2]).fetch(request);
    }
    // GET /rs/me/:uid → OBS用：今いるルームを教え続ける
    if (parts[1] === 'me' && parts[2] && isWs) {
      if (!UID_PATTERN.test(parts[2])) return new Response('bad uid', { status: 400 });
      return env.USER.getByName(parts[2]).fetch(request);
    }
    return new Response('not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
