import { useId } from 'react';
import type { AgentRole } from '../logic/gacha';

/**
 * ロールのマーク。ゲーム内のロールアイコンと同じ「円をくり抜いた形」を白一色で描いたもの
 * デュエリスト＝×／イニシエーター＝稲妻／コントローラー＝山形2本／センチネル＝逆三角
 */
const CUTS: Record<AgentRole, JSX.Element> = {
  Duelist: <path d="M4.5 4.5 19.5 19.5M19.5 4.5 4.5 19.5" strokeWidth="3.4" />,
  Initiator: <polyline points="8.6,0 14.6,9.2 9.6,14.4 15.4,24" strokeWidth="3.2" strokeLinejoin="miter" />,
  Controller: <path d="M2 12.4 12 4.2 22 12.4M2 19.6 12 11.4 22 19.6" strokeWidth="3.1" strokeLinejoin="miter" />,
  Sentinel: <polygon points="4.4,6.6 19.6,6.6 12,19.6" strokeWidth="3" strokeLinejoin="miter" />,
};

export function RoleIcon({ role, size = 20, className = '' }: { role: AgentRole; size?: number; className?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <mask id={id}>
        <rect width="24" height="24" fill="#fff" />
        <g fill="none" stroke="#000">{CUTS[role]}</g>
      </mask>
      <circle cx="12" cy="12" r="11.5" fill="currentColor" mask={`url(#${id})`} />
    </svg>
  );
}
