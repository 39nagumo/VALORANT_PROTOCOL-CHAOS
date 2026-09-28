import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { UID_PATTERN, eventDuration, type Side, type TeamSlot } from '../logic/room';
import { useCurrentRoomOf, useRoom, useServerNow } from './connection';
import { MapReveal, MyCard, Stage, TeamReveal } from './reveal';

/**
 * OBSのブラウザソース用（/me/:uid）。背景は透明。
 * ?part=card だけ / ?part=reveal だけ、?x=&y=&s= でカードの位置と大きさを変えられる
 */
export function OverlayPage() {
  const { uid = '' } = useParams();
  const [params] = useSearchParams();
  const part = params.get('part') ?? 'all';
  const x = Number(params.get('x') ?? 24);
  const y = Number(params.get('y') ?? 410);
  const s = Number(params.get('s') ?? 1);

  useEffect(() => {
    document.title = 'CHAOS GACHA OVERLAY';
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    document.body.style.overflow = 'hidden';
  }, []);

  const valid = UID_PATTERN.test(uid);
  const { roomId, known } = useCurrentRoomOf(valid ? uid : null);
  const { state, memberId, offset, skipEventId } = useRoom(valid ? roomId : null, uid, 'overlay');
  const now = useServerNow(offset, !!state && Date.now() + offset.current < state.lockUntil + 800);

  // 起動直後だけ、つながっているかを小さく出す（配信に長く映らないように）
  const [hint, setHint] = useState(true);
  useEffect(() => { const t = window.setTimeout(() => setHint(false), 8000); return () => window.clearTimeout(t); }, []);

  const e = state?.event;
  const active = e && e.id !== skipEventId && now < e.startedAt + eventDuration(e) ? e : null;
  const t = active ? now - active.startedAt : 0;

  let mine: { slot: TeamSlot; side: Side; index: number } | null = null;
  if (state && memberId) {
    for (const side of ['ATK', 'DEF'] as Side[]) {
      const index = state.teams[side]?.slots.findIndex(sl => sl.memberId === memberId) ?? -1;
      if (index >= 0) mine = { slot: state.teams[side]!.slots[index], side, index };
    }
  }
  // 自分のチームの演出中は、カードは演出が終わってから出す
  const hideCard = active?.kind === 'team' && mine && active.side === mine.side;
  const reroll = active?.kind === 'reroll' && mine && active.side === mine.side && active.index === mine.index
    ? { target: active.target, t, seed: active.id } : null;

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Stage>
        {part !== 'reveal' && mine && !hideCard && (
          <div style={{ position: 'absolute', left: x, top: y, transform: `scale(${s})`, transformOrigin: '0 0' }}>
            <MyCard slot={mine.slot} side={mine.side} reroll={reroll} />
          </div>
        )}
        {part !== 'card' && active?.kind === 'team' && state?.teams[active.side] && (
          <TeamReveal roll={state.teams[active.side]!} event={active} t={t} />
        )}
        {part !== 'card' && active?.kind === 'map' && <MapReveal event={active} t={t} />}
        {hint && (
          <div style={{ position: 'absolute', left: 24, top: 24, padding: '6px 14px', background: 'rgba(15,25,35,.85)', color: '#ECE8E1', fontSize: 18, borderLeft: '4px solid #FF4655' }}>
            CHAOS GACHA：{!valid ? 'URLが正しくありません' : !known ? '接続中…' : !roomId ? 'まだルームに参加していません' : memberId ? '接続しました' : 'ルームに接続中…'}
          </div>
        )}
      </Stage>
    </div>
  );
}
