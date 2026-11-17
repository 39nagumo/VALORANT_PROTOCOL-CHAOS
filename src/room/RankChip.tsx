import { rankOf, type RankId } from '../logic/room';

/** ランクの色の札（点数は出さない）。未設定は薄い枠だけ */
export function RankChip({ rank, size = 'sm' }: { rank: RankId | null | undefined; size?: 'xs' | 'sm' }) {
  const r = rankOf(rank);
  const box = size === 'xs' ? 'h-4 px-1.5 text-[10px]' : 'h-5 px-2 text-[11px]';
  if (!r) return <span className={`inline-flex items-center justify-center shrink-0 font-bold rounded-sm border border-white/20 text-white/40 ${box}`}>未設定</span>;
  return (
    <span className={`inline-flex items-center justify-center shrink-0 font-black rounded-sm border ${box}`}
      style={{ color: r.fg, borderColor: r.fg + '66' }}>{r.label}</span>
  );
}
