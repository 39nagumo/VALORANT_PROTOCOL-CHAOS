import { useState, useEffect, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import bindsRaw from '../data/binds.json';
import { isNewBind } from '../data/bindsNew';
import { backLink, btnGhost, pageTitle } from '../ui/lobby';
// @ts-ignore
import html2canvas from 'html2canvas';

interface Props {
    onBack: () => void;
    onNavigateToSubmit: () => void;
}

export function BindsGallery({ onBack, onNavigateToSubmit }: Props) {
  const navigate = useNavigate();
    const [selectedBind, setSelectedBind] = useState<{ text: string, category: string, id: number } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const categories = [
        'CHAOS',
        'Epic',
        'Exotic',
        'Extra',
        'Special',
        'Unique'
    ] as Array<keyof typeof bindsRaw>;

    const getBindId = (cat: string, index: number) => {
        const baseIds: { [key: string]: number } = {
            'CHAOS': 100,
            'Epic': 200,
            'Exotic': 300,
            'Extra': 400,
            'Special': 500,
            'Unique': 600
        };
        return (baseIds[cat] || 0) + (index + 1);
    };

    const getCategoryColor = (cat: string) => {
        switch (cat) {
            case 'CHAOS': return 'text-red-500 border-red-500 bg-red-500/10';
            case 'Epic': return 'text-purple-500 border-purple-500 bg-purple-500/10';
            case 'Exotic': return 'text-green-500 border-green-500 bg-green-500/10';
            case 'Extra': return 'text-yellow-500 border-yellow-500 bg-yellow-500/10';
            case 'Unique': return 'text-pink-500 border-pink-500 bg-pink-500/10';
            case 'Special': return 'text-cyan-400 border-cyan-400 bg-cyan-400/10';
            default: return 'text-blue-500 border-blue-500 bg-blue-500/10';
        }
    };

    const handleDownload = async () => {
        if (!modalRef.current || !selectedBind) return;
        setIsSaving(true);
        try {
            const canvas = await html2canvas(modalRef.current, {
                backgroundColor: '#101418',
                scale: 2,
                useCORS: true,
                onclone: (clonedDoc) => {
                    const btn = clonedDoc.querySelector('.no-export') as HTMLElement;
                    if (btn) btn.style.display = 'none';
                }
            });
            const link = document.createElement('a');
            link.download = `CHAOS_Binds_${selectedBind.category}_${selectedBind.id}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="animate-fade-in relative">
            <button onClick={onBack} className={`${backLink} mb-3`}>
                ← 戻る
            </button>

            <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
                <div>
                    <h2 className={pageTitle}>縛り一覧</h2>
                    <p className="text-sm text-[#9aa3ad] mt-2">押すと大きく表示して、画像で保存できます</p>
                </div>
                <button onClick={onNavigateToSubmit} className={btnGhost}>
                    縛りを投稿 →
                </button>
            </div>

            <div className="space-y-10 pb-4">
                {categories.map(cat => {
                    if (!bindsRaw[cat]) return null;
                    return (
                        <div key={cat}>
                            <h3 className={`text-2xl font-extrabold mb-3 pl-3 border-l-[6px] ${getCategoryColor(cat).split(' ')[0]} ${getCategoryColor(cat).split(' ')[1]}`}>
                                {cat}
                                <span className="ml-3 text-sm font-bold text-[#9aa3ad]">{bindsRaw[cat].length}個</span>
                            </h3>
                            <div className="grid md:grid-cols-2 gap-2">
                                {bindsRaw[cat].map((text, i) => {
                                    const bindId = getBindId(cat, i);
                                    return (
                                        <div
                                            key={i}
                                            onClick={() => setSelectedBind({ text, category: cat, id: bindId })}
                                            className={`relative bg-[#1a2027] p-4 border hover:bg-[#222a33] cursor-pointer transition-colors flex justify-between items-start gap-4 ${isNewBind(cat, i) ? 'border-[#46CBFF]/50 pr-16' : 'border-transparent'}`}
                                        >
                                            <p className="text-sm font-bold leading-relaxed text-[#ece8e1]">{text}</p>
                                            {isNewBind(cat, i) && (
                                                <span className="absolute top-2 right-2 inline-flex items-center justify-center h-5 px-2 pb-[2px] rounded-full bg-[#46CBFF] text-[#0F1923] text-[11px] font-black leading-none">NEW</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ✅ 下部のホーム戻りボタン周りの pb-20 を pb-4 に変更 */}
            <div className="flex justify-center pb-4 pt-8">
                <button onClick={() => navigate("/")} className={backLink}>
                    トップへ戻る
                </button>
            </div>

            {/* Modal - 詳細表示 */}
            {selectedBind && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 animate-fade-in" onClick={() => setSelectedBind(null)}>
                    <div
                        ref={modalRef}
                        className={`bg-[#101418] border-t-[6px] ${getCategoryColor(selectedBind.category).split(' ')[1]} p-10 max-w-lg w-full relative`}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="absolute top-4 right-4 no-export">
                            <button
                                className="text-[#9aa3ad] hover:text-[#ece8e1] transition-colors p-2 hover:bg-white/5"
                                onClick={handleDownload}
                                disabled={isSaving}
                                title="画像を保存"
                                aria-label="画像を保存"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                            </button>
                        </div>

                        <div className="absolute bottom-4 right-6 text-[11px] font-bold text-white/25">
                            #{selectedBind.id}
                        </div>

                        <div className="flex flex-col items-center text-center">
                            <div className={`h-7 px-4 mb-6 inline-flex items-center justify-center text-sm font-extrabold border ${getCategoryColor(selectedBind.category)}`}>
                                {selectedBind.category}
                            </div>
                            <h3 className="text-2xl md:text-3xl font-extrabold leading-relaxed mb-4 whitespace-pre-wrap text-[#ece8e1]">
                                {selectedBind.text.replace(/^"|"$/g, '')}
                            </h3>
                            <p className="text-xs font-bold text-[#9aa3ad]/60">VALORANT CHAOSガチャ</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}