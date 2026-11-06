import { useEffect } from 'react';

export const HOWTO_IMAGE = '/assets/room-howto.png';
const HOWTO_FILENAME = 'CHAOSガチャ_ルームの使い方.png';

/** ルームの使い方の画像を大きく出す窓（×で閉じる・画像を保存） */
export function HowToModal({ onClose, created }: { onClose: () => void; created?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0F1923]/85 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ルームの使い方"
        className="relative w-full max-w-[1120px] bg-[#172129] border border-white/10 shadow-2xl p-4 md:px-6 md:py-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 w-10 h-0.5 bg-[#FF4655]" />
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-baseline gap-3 flex-wrap min-w-0">
            <h2 className="text-lg md:text-xl font-black">ルームの使い方</h2>
            {created && <span className="text-xs text-gray-400">ルームを作りました。はじめにこれを見てください</span>}
          </div>
          <button type="button" onClick={onClose} aria-label="閉じる"
            className="shrink-0 w-10 h-10 border border-white/30 hover:bg-white/10 text-2xl leading-none flex items-center justify-center">
            ×
          </button>
        </div>
        <img src={HOWTO_IMAGE} alt="ルームの使い方" className="block w-full max-h-[calc(100vh-180px)] object-contain border border-white/10" />
        <div className="mt-3 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-gray-400 [word-break:auto-phrase]">閉じたあとも「ルームに参加」の右上の「使い方」から、もう一度開けます</p>
          <a href={HOWTO_IMAGE} download={HOWTO_FILENAME}
            className="ml-auto inline-flex items-center gap-2 border border-white/30 hover:bg-white/10 text-white/90 font-black text-sm px-5 py-2 tracking-[0.15em]">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 2v8M4 7l4 4 4-4M2 14h12" /></svg>
            画像を保存
          </a>
        </div>
      </div>
    </div>
  );
}
