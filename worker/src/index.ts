import { DurableObject } from 'cloudflare:workers';
import { GachaSystem } from '../../src/logic/gacha';
import { rerollAgent, rerollBind, drawBind } from '../../src/logic/reroll';
import type { Bind } from '../../src/logic/gacha';
import { MAPS } from '../../src/data/maps';
import {
  ClientMessage, Member, RoomEvent, RoomState, ServerMessage, Side, TeamRoll,
  TEAM_SIZE, EVENT_LEAD_MS, TEAM_SHUFFLE_MS, eventDuration,
  UID_PATTERN, ROOM_PATTERN, NAME_MAX, mapPool, isRankId, rankPoints, balancedSplit, isBindRarity, type RankId,
} from '../../src/logic/room';

export interface Env {
  ROOM: DurableObjectNamespace<Room>;
  USER: DurableObjectNamespace<UserHub>;
  LIMITER: DurableObjectNamespace<Limiter>;
  ALLOWED_ORIGINS: string;
  ROOM_LIMIT_PER_IP_HOUR: string;
  ROOM_LIMIT_PER_DAY: string;
  SUBMIT_LIMIT_PER_MIN: string;
  DISCORD_WEBHOOK_URL?: string;
  NOTICE_WEBHOOK_URL?: string;
}

// ルームの名簿に入れる人数（試合は10人。残りは観る人）
const MEMBER_MAX = 20;
// 1つの接続から送れる操作の数（10秒あたり）。普通に押す分には届かない数
const OPS_PER_WINDOW = 30;
const OPS_WINDOW_MS = 10 * 1000;
// 1回に受け取る文の長さの上限（普通の操作は200字もない）
const MESSAGE_MAX = 2000;

/** 名前から、見えない文字・向きを変える記号・改行などを取り除く */
function cleanName(raw: unknown): string {
  return String(raw ?? '').replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '').trim().slice(0, NAME_MAX);
}
const isSide = (v: unknown): v is Side => v === 'ATK' || v === 'DEF';

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
  mapMode: 'BAN',
  mapMarks: [],
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
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    if (text.length > MESSAGE_MAX) return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
    const att = ws.deserializeAttachment() as Attachment;
    try {
      if (this.tooFast(ws)) throw new UserError('操作が続いています。少し時間を空けてください');
      if (msg.type === 'join') {
        await this.join(ws, att, msg.name, msg.rank);
      } else {
        if (att.as !== 'page' || !att.memberId) throw new UserError('先にルームへ参加してください');
        const me = this.state.members.find(m => m.id === att.memberId);
        if (!me) throw new UserError('名簿に見つかりません。参加し直してください');
        await this.handle(msg, me);
      }
    } catch (e) {
      if (e instanceof UserError) this.sendTo(ws, { type: 'error', message: e.message });
      else throw e;
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    this.opTimes.delete(ws);
    try { ws.close(); } catch { /* 既に閉じている */ }
    if (att?.as === 'overlay') this.broadcast(ws);
  }

  // 接続ごとの、最近の操作の時刻（休止から戻ると空になるが、それで困ることはない）
  private opTimes = new Map<WebSocket, number[]>();
  private tooFast(ws: WebSocket): boolean {
    const now = Date.now();
    const times = (this.opTimes.get(ws) ?? []).filter(t => now - t < OPS_WINDOW_MS);
    if (times.length >= OPS_PER_WINDOW) { this.opTimes.set(ws, times); return true; }
    times.push(now);
    this.opTimes.set(ws, times);
    return false;
  }

  private async join(ws: WebSocket, att: Attachment, rawName: string, rawRank?: unknown) {
    const s = this.state!;
    const name = cleanName(rawName);
    // ランクは送られてきたときだけ変える（null＝「選ばない」に戻す）
    const rank: RankId | null | undefined = isRankId(rawRank) ? rawRank : rawRank === null ? null : undefined;
    if (!name) throw new UserError('名前を入力してください');
    const memberId = await publicIdOf(att.uid);
    const sameName = s.members.find(m => m.name === name && m.id !== memberId);
    if (sameName) throw new UserError(`「${name}」は既に名簿にいます。別の名前にしてください`);

    const existing = s.members.find(m => m.id === memberId);
    if (existing) {
      existing.name = name;
      if (rank !== undefined) existing.rank = rank;
      for (const side of ['ATK', 'DEF'] as Side[]) {
        s.teams[side]?.slots.forEach(slot => { if (slot.memberId === memberId) slot.name = name; });
      }
    } else {
      if (s.members.length >= MEMBER_MAX) throw new UserError(`このルームは満員です（${MEMBER_MAX}人まで）`);
      s.members.push({ id: memberId, name, seat: 'WATCH', online: false, rank: rank ?? null });
    }
    this.secrets[memberId] = att.uid;
    // 最初に参加した人（＝ルームを作った人）がルームの主
    if (!s.owner) s.owner = memberId;
    ws.serializeAttachment({ ...att, memberId } satisfies Attachment);
    // この人のOBSを、このルームに切り替える
    await this.env.USER.getByName(att.uid).setRoom(this.roomId);
    this.sendTo(ws, { type: 'joined', memberId });
    this.save();
  }

  private async handle(msg: Exclude<ClientMessage, { type: 'join' }>, me: Member) {
    const s = this.state!;
    const by = me.name;
    // 主の仕組みより前に作られたルームは、名簿のいちばん上の人を主にする
    if (!s.owner && s.members.length) s.owner = s.members[0].id;
    const now = Date.now();
    const busy = () => {
      if (now < s.lockUntil) throw new UserError(s.display?.kind === 'teamSetup' && s.display.shuffled ? `${s.display.by}さんのチーム分けの演出中です` : `${s.event?.by ?? '誰か'}さんの抽選の演出中です`);
    };

    // 届いた値の形を先に確かめる（画面から普通に送られる値以外は黙って捨てる）
    if ((msg.type === 'roll' || msg.type === 'reroll') && !isSide(msg.side)) return;
    if (msg.type === 'reroll' && (!Number.isInteger(msg.index) || msg.index < 0 || msg.index >= TEAM_SIZE || (msg.target !== 'agent' && msg.target !== 'bind'))) return;
    if ((msg.type === 'seat' && typeof msg.memberId !== 'string') || (msg.type === 'mapMark' && typeof msg.mapId !== 'string')) return;
    if (msg.type === 'kick' && typeof msg.memberId !== 'string') return;
    if ((msg.type === 'bindPick' || msg.type === 'extraBind') && (typeof msg.memberId !== 'string' || !(msg.rarity === null || isBindRarity(msg.rarity)))) return;
    if (msg.type === 'rerollExtra' && (!isSide(msg.side) || !Number.isInteger(msg.index) || msg.index < 0 || msg.index >= TEAM_SIZE)) return;

    switch (msg.type) {
      case 'bindPick':
      case 'extraBind': {
        const m = s.members.find(x => x.id === msg.memberId);
        if (!m) throw new UserError('名簿に見つかりません');
        if (msg.type === 'bindPick') m.bindPick = msg.rarity; else m.extraRarity = msg.rarity;
        // もう抽選が済んでいれば、その人の縛りをその場で入れ替える
        for (const side of ['ATK', 'DEF'] as Side[]) {
          const team = s.teams[side];
          const slot = team?.slots.find(x => x.memberId === m.id);
          if (!team || !slot) continue;
          const others = team.slots.flatMap(x => (x === slot ? [] : [x.bind.text, ...(x.extra ? [x.extra.text] : [])]));
          if (msg.type === 'bindPick') {
            if (msg.rarity && msg.rarity !== slot.bind.rarity) {
              const next = drawBind(msg.rarity, [...others, ...(slot.extra ? [slot.extra.text] : [])]);
              if (next) slot.bind = next;
            }
          } else {
            slot.extra = msg.rarity ? drawBind(msg.rarity, [...others, slot.bind.text]) : null;
          }
        }
        break;
      }
      case 'rerollExtra': {
        busy();
        const team = s.teams[msg.side];
        const slot = team?.slots[msg.index];
        if (!team || !slot?.extra) throw new UserError('2つ目の縛りがありません');
        const others = team.slots.flatMap(x => [x.bind.text, ...(x.extra && x !== slot ? [x.extra.text] : [])]);
        const next = drawBind(slot.extra.rarity, [...others, slot.extra.text]);
        if (!next) throw new UserError('ほかに候補がありません');
        slot.extra = next;
        this.startEvent({ kind: 'reroll', id: crypto.randomUUID(), side: msg.side, index: msg.index, target: 'extra', startedAt: now + EVENT_LEAD_MS, by });
        break;
      }
      case 'leave':
        await this.removeMember(me.id, false);
        break;
      case 'kick': {
        if (s.owner !== me.id) throw new UserError('名簿から外せるのは、ルームの主だけです');
        if (msg.memberId === me.id) throw new UserError('自分を外すときは「名簿から抜ける」を使ってください');
        if (!s.members.some(m => m.id === msg.memberId)) throw new UserError('名簿に見つかりません');
        await this.removeMember(msg.memberId, true);
        break;
      }
      case 'seat': {
        const m = s.members.find(x => x.id === msg.memberId);
        if (!m) throw new UserError('名簿に見つかりません');
        if (msg.seat !== 'ATK' && msg.seat !== 'DEF' && msg.seat !== 'WATCH') return;
        if (s.display?.kind === 'teamSetup' && s.display.shuffled && now < s.lockUntil) throw new UserError(`${s.display.by}さんのチーム分けの演出中です`);
        // 振り分けの途中で一時的に5人を超えてもよい（回すときに5人ちょうどかを見る）
        m.seat = msg.seat;
        break;
      }
      case 'randomTeams': {
        busy();
        // 今チームにいる人を優先し、足りなければOBSを開いている人→それ以外の順に補う
        const seated = s.members.filter(m => m.seat !== 'WATCH');
        const rest = s.members.filter(m => m.seat === 'WATCH');
        const fill = [...shuffle(rest.filter(m => m.online)), ...shuffle(rest.filter(m => !m.online))];
        const players = shuffle([...seated, ...fill].slice(0, TEAM_SIZE * 2));
        // 自己申告のランクの点数で、合計がなるべく等しくなるように分ける
        const [atk, def] = balancedSplit(players, m => rankPoints(m.rank), m => m.seat === 'ATK');
        s.members.forEach(m => { m.seat = 'WATCH'; });
        atk.forEach(m => { m.seat = 'ATK'; });
        def.forEach(m => { m.seat = 'DEF'; });
        // 分けた結果は、名前が回ってから決まる演出つきでOBSに出す。
        // 演出が終わるまでは、ほかの抽選も席の移動も受け付けない（管理する人の画面だけ先に進めないように）
        const startedAt = now + EVENT_LEAD_MS;
        s.display = { kind: 'teamSetup', id: crypto.randomUUID(), startedAt, by, shuffled: true };
        s.lockUntil = startedAt + TEAM_SHUFFLE_MS;
        break;
      }
      case 'roll': {
        busy();
        const players = s.members.filter(m => m.seat === msg.side);
        if (players.length !== TEAM_SIZE) throw new UserError(`${TEAM_SIZE}人ちょうどにしてから回してください（今${players.length}人）`);
        // 縛りのレア度を指定された人は、そのレア度から先に引いて固定する（残りの人に元の決まりで残りを配る）
        const taken: string[] = [];
        const locked = players.flatMap((p, i) => {
          if (!p.bindPick) return [];
          const bind = drawBind(p.bindPick, taken);
          if (!bind) return [];
          taken.push(bind.text);
          return [{ index: i, bind }];
        });
        const res = new GachaSystem().runGacha(players.map(p => p.name), locked);
        // 2つ目の縛り（任意）：選んだレア度から、チーム内で被らないものを引く
        const used = res.binds.map(b => b.text);
        s.teams[msg.side] = {
          side: msg.side,
          slots: players.map((p, i) => {
            let extra: Bind | null = null;
            if (p.extraRarity) { extra = drawBind(p.extraRarity, used); if (extra) used.push(extra.text); }
            return { memberId: p.id, name: p.name, agent: res.players[i].agent, bind: res.binds[i], extra };
          }),
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
      case 'mapMode':
        if (msg.mode !== 'PICK' && msg.mode !== 'BAN') return;
        busy();
        if (s.mapMode !== msg.mode) { s.mapMode = msg.mode; s.mapMarks = []; }
        this.showMapSetup(by);
        break;
      case 'mapMark': {
        if (!MAPS.some(m => m.id === msg.mapId)) return;
        busy();
        const marks = s.mapMarks ?? [];
        s.mapMarks = marks.includes(msg.mapId) ? marks.filter(id => id !== msg.mapId) : [...marks, msg.mapId];
        this.showMapSetup(by);
        break;
      }
      case 'mapRoll': {
        busy();
        if (s.display?.kind !== 'mapSetup' && s.display?.kind !== 'map') {
          throw new UserError('先に「マップ候補をOBSに出す」を押してください');
        }
        s.mapMode ??= 'BAN';
        const pool = mapPool(MAPS.map(m => m.id), s);
        if (pool.length === 0) {
          throw new UserError(s.mapMode === 'PICK' ? '候補のマップを選んでください' : '候補のマップがありません。BANか「出たマップを戻す」で調整してください');
        }
        const mapId = pool[Math.floor(Math.random() * pool.length)];
        s.map = mapId;
        s.mapHistory = [...s.mapHistory, mapId];
        this.startEvent({ kind: 'map', id: crypto.randomUUID(), mapId, pool, startedAt: now + EVENT_LEAD_MS, by });
        break;
      }
      case 'closeDisplay':
        s.display = null;
        break;
      case 'showTeamSetup':
        if (s.display?.kind === 'teamSetup') return;
        busy();
        s.display = { kind: 'teamSetup', id: crypto.randomUUID(), startedAt: now, by };
        break;
      case 'showMapSetup':
        if (s.display?.kind === 'mapSetup') return;
        busy();
        this.showMapSetup(by);
        break;
      case 'mapClearHistory':
        busy();
        s.mapHistory = [];
        this.showMapSetup(by);
        break;
      case 'newMatch':
        s.teams = { ATK: null, DEF: null };
        s.map = null;
        s.mapMarks = []; // PICK/BANの印は消す（一度出たマップの「済」は残す）
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

  /** 名簿から外す（本人が抜ける・主が外す）。チームの抽選結果は残し、回し直すと反映される */
  private async removeMember(id: string, kicked: boolean) {
    const s = this.state!;
    const uid = this.secrets[id];
    s.members = s.members.filter(m => m.id !== id);
    delete this.secrets[id];
    if (s.owner === id) s.owner = s.members[0]?.id ?? null;
    for (const ws of this.ctx.getWebSockets('page')) {
      const a = ws.deserializeAttachment() as Attachment | null;
      if (a?.memberId !== id) continue;
      ws.serializeAttachment({ ...a, memberId: null } satisfies Attachment);
      this.sendTo(ws, { type: 'left', kicked });
    }
    // この人のOBSは、まだこのルームを映していれば外す
    if (uid) await this.env.USER.getByName(uid).setRoom(null, this.roomId);
  }

  /** マップのPICK/BANを触ったら、OBSをマップ選びの画面にして印の状態を全員に見せる（演出中は割り込まない） */
  private showMapSetup(by: string) {
    const s = this.state!;
    if (Date.now() < s.lockUntil || s.display?.kind === 'mapSetup') return;
    s.display = { kind: 'mapSetup', id: crypto.randomUUID(), startedAt: Date.now(), by };
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
  async setRoom(roomId: string | null, onlyIf?: string): Promise<void> {
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

// 本番URLに加えて、Vercelのプレビュー用URL（valorant-protocol-chaos-….vercel.app）も許可する
const PREVIEW_ORIGIN = /^https:\/\/valorant-protocol-chaos-[a-z0-9-]+\.vercel\.app$/;

/** 回数制限：直近 windowMs の間に limit 回まで。超えたら、次に使えるまでのミリ秒を返す */
export class Limiter extends DurableObject<Env> {
  async hit(limit: number, windowMs: number): Promise<{ ok: boolean; retryAfterMs: number }> {
    const now = Date.now();
    const times = ((await this.ctx.storage.get<number[]>('times')) ?? []).filter(t => now - t < windowMs);
    if (times.length >= limit) {
      return { ok: false, retryAfterMs: windowMs - (now - times[0]) };
    }
    times.push(now);
    await this.ctx.storage.put('times', times);
    // 使われなくなったら記録を消す
    await this.ctx.storage.setAlarm(now + windowMs);
    return { ok: true, retryAfterMs: 0 };
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/;

/** うちのサイト（本番・プレビュー）から来たか。手元の開発（wrangler dev）では見ない */
function originOk(request: Request, env: Env): boolean {
  if (LOCAL_HOST.test(new URL(request.url).hostname)) return true;
  const origin = request.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map(s => s.trim());
  return allowed.includes(origin) || PREVIEW_ORIGIN.test(origin);
}

function cors(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  return origin && originOk(request, env) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {};
}

async function postDiscord(url: string, payload: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return res.ok;
  } catch {
    return false;
  }
}

/** サイト全体の上限に達したことを、1日1回だけ Discord に知らせる */
async function noticeDailyLimit(env: Env): Promise<void> {
  const url = env.NOTICE_WEBHOOK_URL || env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  const once = await env.LIMITER.getByName('notice:daily-limit').hit(1, 24 * 60 * 60 * 1000);
  if (!once.ok) return;
  await postDiscord(url, {
    allowed_mentions: { parse: [] },
    embeds: [{
      title: '⚠️ 上限に達しました：ルーム作成（サイト全体・1日）',
      description: `ここ24時間で ${env.ROOM_LIMIT_PER_DAY} 個のルームが作られ、新しいルームを作れない状態です。\nいたずらでなければ、worker/wrangler.jsonc の ROOM_LIMIT_PER_DAY を上げて出し直してください。`,
      color: 0xef4444,
      timestamp: new Date().toISOString(),
    }],
  });
}

// 縛りアイデアの投稿（Discord へ中継する）
const BIND_COLORS: Record<string, number> = {
  CHAOS: 0xef4444, Epic: 0xa855f7, Exotic: 0x22c55e, Extra: 0xeab308, Unique: 0xec4899, Special: 0x22d3ee,
};
const BIND_TEXT_MAX = 500;

async function submitBind(request: Request, env: Env): Promise<Response> {
  const headers = cors(request, env);
  if (!originOk(request, env)) return Response.json({ error: 'forbidden' }, { status: 403, headers });
  if (!env.DISCORD_WEBHOOK_URL) return Response.json({ error: 'not_configured' }, { status: 503, headers });
  const body = await request.json().catch(() => ({})) as { category?: unknown; text?: unknown };
  const category = typeof body.category === 'string' ? body.category : '';
  // 改行とタブは残し、そのほかの見えない文字は取り除く
  const text = typeof body.text === 'string' ? body.text.replace(/[^\P{Cc}\n\t]|\p{Cf}/gu, '').trim() : '';
  if (!(category in BIND_COLORS)) return Response.json({ error: 'bad_category' }, { status: 400, headers });
  if (!text || text.length > BIND_TEXT_MAX) return Response.json({ error: 'bad_text' }, { status: 400, headers });

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const limit = await env.LIMITER.getByName(`submit:${ip}`).hit(Number(env.SUBMIT_LIMIT_PER_MIN) || 3, 60 * 1000);
  if (!limit.ok) return Response.json({ error: 'too_many' }, { status: 429, headers });

  const ok = await postDiscord(env.DISCORD_WEBHOOK_URL, {
    allowed_mentions: { parse: [] }, // @everyone やロールへのメンションを無効化
    embeds: [{
      title: '📌 新しい縛りアイデアの投稿',
      color: BIND_COLORS[category],
      fields: [
        { name: 'レアリティ', value: category, inline: true },
        { name: '内容', value: text },
      ],
      footer: { text: 'Protocol Archive Suggestion' },
      timestamp: new Date().toISOString(),
    }],
  });
  return ok ? Response.json({ ok: true }, { headers }) : Response.json({ error: 'discord' }, { status: 502, headers });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean); // ['rs', ...]
    if (parts[0] !== 'rs') return new Response('not found', { status: 404 });

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { ...cors(request, env), 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
    }

    // POST /rs/submit → 縛りアイデアを Discord へ送る
    if (parts[1] === 'submit' && parts.length === 2 && request.method === 'POST') {
      return submitBind(request, env);
    }

    // POST /rs/rooms → 新しいルームを作る
    if (parts[1] === 'rooms' && parts.length === 2 && request.method === 'POST') {
      if (!originOk(request, env)) return Response.json({ error: 'forbidden' }, { status: 403 });
      // 同じ回線（IP）から1時間に10個まで、サイト全体で1日700個まで（無料枠の1日10万リクエストに収まる目安）
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const perIpLimit = Number(env.ROOM_LIMIT_PER_IP_HOUR) || 10;
      const perIp = await env.LIMITER.getByName(`ip:${ip}`).hit(perIpLimit, 60 * 60 * 1000);
      if (!perIp.ok) {
        return Response.json({ error: 'too_many' }, { status: 429, headers: cors(request, env) });
      }
      const total = await env.LIMITER.getByName('all').hit(Number(env.ROOM_LIMIT_PER_DAY) || 700, 24 * 60 * 60 * 1000);
      if (!total.ok) {
        ctx.waitUntil(noticeDailyLimit(env));
        return Response.json({ error: 'busy' }, { status: 429, headers: cors(request, env) });
      }
      const roomId = newRoomId();
      await env.ROOM.getByName(roomId).init(roomId);
      return Response.json({ roomId }, { headers: cors(request, env) });
    }

    const isWs = request.headers.get('Upgrade') === 'websocket';
    // ルームとOBS表示へつなげるのは、うちのサイトから開いたページだけ
    if (isWs && !originOk(request, env)) return new Response('forbidden', { status: 403 });
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
