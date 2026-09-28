import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, RoomState, ServerMessage } from '../logic/room';
import { eventDuration } from '../logic/room';

// 本番は別ドメインの同期サーバー、ローカルは Vite のプロキシ（/rs）を使う
const SERVER = (import.meta.env.VITE_ROOM_SERVER as string | undefined)?.replace(/\/$/, '') ?? '';

const wsUrl = (path: string) => {
  if (SERVER) return SERVER.replace(/^http/, 'ws') + path;
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${path}`;
};

/** ルームを作る。作れなかったときは、画面にそのまま出せる理由を投げる */
export async function createRoom(): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${SERVER}/rs/rooms`, { method: 'POST' });
  } catch {
    throw new Error('ルームを作れませんでした。通信を確認して、もう一度お試しください。');
  }
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    const min = body.retryAfterMin ?? 60;
    throw new Error(body.error === 'busy'
      ? `今日はルームがたくさん作られたため、いったん受付を止めています（約${min}分後に再開）。`
      : `ルームを作れるのは1時間に5個までです。約${min}分後にもう一度お試しください。`);
  }
  if (!res.ok) throw new Error('ルームを作れませんでした。時間をおいてもう一度お試しください。');
  return (await res.json()).roomId;
}

type Status = 'connecting' | 'open' | 'closed';

/** 切れても自動でつなぎ直すWebSocket。最後に受け取った内容は、つながっていない間も残す */
function useSocket(path: string | null, onMessage: (data: unknown) => void) {
  const [status, setStatus] = useState<Status>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const handler = useRef(onMessage);
  handler.current = onMessage;
  const finalRef = useRef(false);

  useEffect(() => {
    if (!path) return;
    let stopped = false;
    let retry = 0;
    let timer: number | undefined;
    finalRef.current = false;
    const connect = () => {
      setStatus('connecting');
      const ws = new WebSocket(wsUrl(path));
      wsRef.current = ws;
      ws.onopen = () => { retry = 0; setStatus('open'); };
      ws.onmessage = ev => {
        try { handler.current(JSON.parse(ev.data)); } catch { /* 壊れたメッセージは無視 */ }
      };
      ws.onclose = () => {
        if (stopped) return;
        if (finalRef.current) { setStatus('closed'); return; }
        setStatus('connecting');
        timer = window.setTimeout(connect, Math.min(10000, 500 * 2 ** retry++));
      };
    };
    connect();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      wsRef.current?.close();
    };
  }, [path]);

  const send = useCallback((msg: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);
  const markFinal = useCallback(() => { finalRef.current = true; }, []);
  return { status, send, markFinal };
}

export function useRoom(roomId: string | null, uid: string, as: 'page' | 'overlay') {
  const [state, setState] = useState<RoomState | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [movedTo, setMovedTo] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offset = useRef(0); // サーバー時刻 − 手元の時刻
  // 開いた時点で既に流れていた演出は、途中から見せずに飛ばす
  const [skipEventId, setSkipEventId] = useState<string | null>(null);
  const firstState = useRef(true);

  useEffect(() => {
    setState(null); setMemberId(null); setMovedTo(null); setClosed(false);
    firstState.current = true;
  }, [roomId]);

  const path = roomId ? `/rs/room/${roomId}?uid=${uid}&as=${as}` : null;
  const { status, send, markFinal } = useSocket(path, data => {
    const msg = data as ServerMessage;
    switch (msg.type) {
      case 'state': {
        offset.current = msg.now - Date.now();
        const e = msg.state.event;
        if (firstState.current && e && msg.now - e.startedAt > 1500 && msg.now < e.startedAt + eventDuration(e)) {
          setSkipEventId(e.id);
        }
        firstState.current = false;
        setState(msg.state);
        break;
      }
      case 'joined': setMemberId(msg.memberId); break;
      case 'error': setError(msg.message); break;
      case 'moved': markFinal(); setMovedTo(msg.roomId); break;
      case 'closed': markFinal(); setClosed(true); break;
    }
  });

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 4000);
    return () => window.clearTimeout(t);
  }, [error]);

  const act = useCallback((msg: ClientMessage) => send(msg), [send]);
  return { state, memberId, status, movedTo, closed, error, act, offset, skipEventId };
}

/** OBS用：この人が今いるルームを追いかける */
export function useCurrentRoomOf(uid: string | null) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [known, setKnown] = useState(false);
  useSocket(uid ? `/rs/me/${uid}` : null, data => {
    const msg = data as { type: string; roomId: string | null };
    if (msg.type === 'room') { setRoomId(msg.roomId); setKnown(true); }
  });
  return { roomId, known };
}

/** サーバー時刻。演出中は毎フレーム、それ以外はゆっくり更新する */
export function useServerNow(offset: React.MutableRefObject<number>, fast: boolean) {
  const [now, setNow] = useState(() => Date.now() + offset.current);
  useEffect(() => {
    let raf = 0;
    let timer = 0;
    const tick = () => {
      setNow(Date.now() + offset.current);
      if (fast) raf = requestAnimationFrame(tick);
    };
    // 画面に出ていないタブやOBSのソースでは描画の合図が止まるので、タイマーでも進める
    if (fast) raf = requestAnimationFrame(tick);
    timer = window.setInterval(tick, fast ? 100 : 250);
    return () => { cancelAnimationFrame(raf); window.clearInterval(timer); };
  }, [fast, offset]);
  return now;
}
