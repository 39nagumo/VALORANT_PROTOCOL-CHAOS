import { useNavigate } from 'react-router-dom';

const LINKS = [
  { to: '/maps', label: 'マップ抽選', note: 'マップだけ回す' },
  { to: '/binds', label: '縛り一覧', note: '全部の縛りを見る' },
  { to: '/submit', label: '縛りを投稿', note: 'アイデアを送る' },
];

export function SubLinks() {
  const navigate = useNavigate();

  return (
    <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-2">
      {LINKS.map(link => (
        <button key={link.to} onClick={() => navigate(link.to)}
          className="group flex items-center justify-between gap-4 bg-[#1a2027] hover:bg-[#222a33] px-5 py-4 text-left transition-colors">
          <span>
            <span className="block font-extrabold">{link.label}</span>
            <span className="block text-xs text-[#9aa3ad] mt-0.5">{link.note}</span>
          </span>
          <span className="text-[#9aa3ad] group-hover:text-[#ff4655] group-hover:translate-x-1 transition-all" aria-hidden="true">→</span>
        </button>
      ))}
    </div>
  );
}
