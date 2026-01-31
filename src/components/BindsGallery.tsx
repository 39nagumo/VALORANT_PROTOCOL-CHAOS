import { useState, useEffect, useRef } from 'react';
import bindsRaw from '../data/binds.json';
// @ts-ignore
import html2canvas from 'html2canvas';

interface Props {
    onBack: () => void;
    onNavigateToSubmit: () => void;
}

export function BindsGallery({ onBack, onNavigateToSubmit }: Props) {
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
                backgroundColor: '#0F1923',
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
            <button
                onClick={onBack}
                className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
                ← Back to Gacha
            </button>

            <div className="flex justify-between items-center mb-8 border-b-2 border-gray-700 pb-4">
                <h2 className="text-3xl font-black uppercase italic">
                    Binds Database（縛り内容一覧）
                </h2>
                <button 
                    onClick={onNavigateToSubmit}
                    className="text-[11px] font-black uppercase tracking-[0.2em] px-4 py-2 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-all rounded-sm"
                >
                    アイデア募集中 →
                </button>
            </div>

            {/* ✅ space-y-12 は維持しつつ、pb-20 を pb-4 に変更して下の空きを詰めました */}
            <div className="space-y-12 pb-4">
                {categories.map(cat => {
                    if (!bindsRaw[cat]) return null;
                    return (
                        <div key={cat}>
                            <h3 className={`text-2xl font-bold uppercase tracking-widest mb-4 pl-4 border-l-4 ${getCategoryColor(cat).split(' ')[0]}`}>
                                {cat}
                            </h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                {bindsRaw[cat].map((text, i) => {
                                    const bindId = getBindId(cat, i);
                                    return (
                                        <div
                                            key={i}
                                            onClick={() => setSelectedBind({ text, category: cat, id: bindId })}
                                            className="bg-[#1F2631] p-4 rounded border border-transparent hover:border-white/20 hover:bg-[#2C3545] cursor-pointer transition-all active:scale-95 flex justify-between items-start gap-4"
                                        >
                                            <p className="text-sm font-medium leading-relaxed">{text}</p>
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
                <button 
                    onClick={() => window.location.reload()} 
                    className="text-xs text-white/60 hover:text-white underline transition-colors uppercase tracking-[0.2em] font-bold"
                >
                    ← Back to HOME
                </button>
            </div>

            {/* Modal - 詳細表示 */}
            {selectedBind && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in" onClick={() => setSelectedBind(null)}>
                    <div
                        ref={modalRef}
                        className="bg-[#0F1923] border border-white/10 p-10 max-w-lg w-full relative shadow-[0_0_50px_rgba(0,0,0,0.5)] transform scale-100 transition-transform"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="absolute top-4 right-4 no-export">
                            <button
                                className="text-gray-500 hover:text-cyan-400 transition-colors p-2 border border-transparent hover:border-cyan-400/30 rounded"
                                onClick={handleDownload}
                                disabled={isSaving}
                                title="Download Image"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                            </button>
                        </div>

                        <div className="absolute bottom-4 right-6 text-[10px] font-mono text-white/25 tracking-widest">
                            #{selectedBind.id}
                        </div>

                        <div className="flex flex-col items-center text-center">
                            <div className={`px-4 py-1 mb-6 text-[10px] font-black tracking-[0.2em] uppercase border ${getCategoryColor(selectedBind.category)}`}>
                                {selectedBind.category}
                            </div>
                            <h3 className="text-2xl md:text-3xl font-black leading-relaxed mb-8 italic uppercase tracking-tight whitespace-pre-wrap">
                                {selectedBind.text.replace(/^"|"$/g, '')}
                            </h3>
                            <div className="w-12 h-[2px] bg-[#FF4655]" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}