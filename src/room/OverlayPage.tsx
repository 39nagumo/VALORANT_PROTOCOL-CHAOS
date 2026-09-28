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

  // 抽選結果の画面は、誰かが「閉じる」を押すまで出し続ける
  const display = state?.display ?? null;
  const dT = display ? (display.id === skipEventId ? Infinity : now - display.startedAt) : 0;
  const e = state?.event;
  const rerolling = e?.kind === 'reroll' && e.id !== skipEventId && now < e.startedAt + eventDuration(e) ? e : null;
  const rerollAnim = rerolling ? { index: rerolling.index, side: rerolling.side, target: rerolling.target, t: now - rerolling.startedAt, seed: rerolling.id } : null;

  let mine: { slot: TeamSlot; side: Side; index: number } | null = null;
  if (state && memberId) {
    for (const side of ['ATK', 'DEF'] as Side[]) {
      const index = state.teams[side]?.slots.findIndex(sl => sl.memberId === memberId) ?? -1;
      if (index >= 0) mine = { slot: state.teams[side]!.slots[index], side, index };
    }
  }
  const myReroll = rerollAnim && mine && rerollAnim.side === mine.side && rerollAnim.index === mine.index ? rerollAnim : null;

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Stage>
        {part !== 'reveal' && mine && !display && (
          <div style={{ position: 'absolute', left: x, top: y, transform: `scale(${s})`, transformOrigin: '0 0' }}>
            <MyCard slot={mine.slot} side={mine.side} reroll={myReroll} />
          </div>
        )}
        {part !== 'card' && display?.kind === 'team' && state?.teams[display.side] && (
          <TeamReveal roll={state.teams[display.side]!} event={display} t={dT}
            reroll={rerollAnim?.side === display.side ? rerollAnim : null} meId={memberId} />
        )}
        {part !== 'card' && display?.kind === 'map' && <MapReveal event={display} t={dT} />}
        {hint && (
          <div style={{ position: 'absolute', left: 24, top: 24, padding: '6px 14px', background: 'rgba(15,25,35,.85)', color: '#ECE8E1', fontSize: 18, borderLeft: '4px solid #FF4655' }}>
            CHAOS GACHA：{!valid ? 'URLが正しくありません' : !known ? '接続中…' : !roomId ? 'まだルームに参加していません' : memberId ? '接続しました' : 'ルームに接続中…'}
          </div>
        )}
      </Stage>
    </div>
  );
}
