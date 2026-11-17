import { RANKS, rankOf, type RankId } from '../logic/room';

/** ランクの色の札（点数は出さない）。未設定は薄い枠だけ */
export function RankChip({ rank, size = 'sm' }: { rank: RankId | null | undefined; size?: 'xs' | 'sm' }) {
  const r = rankOf(rank);
  const box = size === 'xs' ? 'h-4 px-1.5 text-[10px]' : 'h-5 px-2 text-[11px]';
  if (!r) return <span className={`inline-flex items-center justify-center shrink-0 font-bold rounded-sm border border-white/20 text-white/40 ${box}`}>未設定</span>;
  return (
    <span className={`inline-flex items-center justify-center shrink-0 font-black rounded-sm ${box}`}
      style={{ background: r.color, color: r.ink }}>{r.label}</span>
  );
}

/** ランクを色の札で選ぶ（参加画面など広い所で使う） */
export function RankPicker({ value, onChange }: { value: RankId | null; onChange: (r: RankId | null) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {RANKS.map(r => {
        const on = value === r.id;
        return (
          <button key={r.id} type="button" onClick={() => onChange(on ? null : r.id)} aria-pressed={on}
            className={`h-10 inline-flex items-center justify-center text-sm font-black rounded-sm transition ${on ? 'ring-2 ring-white ring-offset-2 ring-offset-[#172129]' : 'opacity-60 hover:opacity-100'}`}
            style={{ background: r.color, color: r.ink }}>
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
