import { useNavigate } from 'react-router-dom';

const LINKS = [
  { to: '/maps', label: 'Map Selection' },
  { to: '/binds', label: 'Binds Database' },
  { to: '/submit', label: 'Suggest a Bind' },
];

export function SubLinks() {
  const navigate = useNavigate();

  return (
    <div className="mt-12 flex flex-wrap justify-center gap-8">
      {LINKS.map(link => (
        <button key={link.to} onClick={() => navigate(link.to)} className="group relative flex items-center gap-4 px-8 py-3 text-[11px] font-black tracking-[0.25em] uppercase transition-all">
          <span className="relative z-10 text-white/40 group-hover:text-white transition-colors">{link.label}</span>
          <div className="w-8 h-px bg-[#FF4655] relative z-10 group-hover:w-12 transition-all" />
        </button>
      ))}
    </div>
  );
}
