import type { AgentRole } from '../logic/gacha';

/**
 * ロールの見分け用マーク（公式アイコンではなく、このサイト用に描いた簡単な記号）
 * デュエリスト＝稲妻 / イニシエーター＝索敵の円 / コントローラー＝煙 / センチネル＝盾
 */
export function RoleIcon({ role, size = 20, className = '' }: { role: AgentRole; size?: number; className?: string }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', className, 'aria-hidden': true } as const;
  switch (role) {
    case 'Duelist':
      return (
        <svg {...common}><path d="M13.5 2 5 13.5h5.5L9 22l9.5-12.5H13z" fill="currentColor" /></svg>
      );
    case 'Initiator':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.4">
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
          <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" strokeLinecap="round" />
        </svg>
      );
    case 'Controller':
      return (
        <svg {...common}>
          <path d="M7 19a5 5 0 0 1-.6-9.96A6.5 6.5 0 0 1 18.8 8.6 4.8 4.8 0 0 1 18 19z" fill="currentColor" />
        </svg>
      );
    case 'Sentinel':
      return (
        <svg {...common}>
          <path d="M12 2 4 5.2v6.1c0 5 3.4 9.1 8 10.7 4.6-1.6 8-5.7 8-10.7V5.2z" fill="currentColor" />
          <path d="M12 6.5v11" stroke="rgba(0,0,0,.35)" strokeWidth="2" />
        </svg>
      );
  }
}
