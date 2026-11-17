import { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { submitBind } from '../room/connection';

interface Props {
    onBack: () => void;
}

export function SubmissionPage({ onBack }: Props) {
  const navigate = useNavigate();
    const [category, setCategory] = useState('CHAOS');
    const [text, setText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [sentText, setSentText] = useState('');
    const [error, setError] = useState('');

    const getCategoryStyles = (cat: string) => {
        switch (cat) {
            case 'CHAOS': return 'border-red-500 bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]';
            case 'Epic': return 'border-purple-500 bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]';
            case 'Exotic': return 'border-green-500 bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)]';
            case 'Extra': return 'border-yellow-500 bg-yellow-500 text-white shadow-[0_0_20px_rgba(234,179,8,0.4)]';
            case 'Unique': return 'border-pink-500 bg-pink-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.4)]';
            case 'Special': return 'border-cyan-400 bg-cyan-400 text-white shadow-[0_0_20px_rgba(34,211,238,0.4)]';
            default: return 'border-blue-500 bg-blue-500 text-white';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim() || isSubmitting) return;

        setIsSubmitting(true);
        setError('');

        try {
            await submitBind(category, text);
            setSentText(text.trim());
            setText('');
            setIsSuccess(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            setError(err instanceof Error ? err.message : '送れませんでした。時間をおいて、もう一度お試しください。');
        } finally {
            setIsSubmitting(false);
        }
    };

    // 送れたら、入力欄の代わりに「届きました」をはっきり出す（消えない）
    if (isSuccess) {
        return (
            <div className="animate-fade-in max-w-4xl mx-auto pb-4 px-4">
                <div className="border-l-[6px] border-[#FF4655] pl-8 mb-12 mt-16">
                    <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter leading-none">
                        Suggest a <span className="text-[#FF4655]">Bind</span>
                    </h2>
                </div>
                <div className="bg-black/40 p-8 md:p-12 border border-cyan-400/40 rounded-sm shadow-2xl backdrop-blur-sm text-center">
                    <p className="text-cyan-300 text-2xl md:text-3xl font-black">✓ 送信しました</p>
                    <p className="mt-4 text-white/80 text-sm md:text-base">縛りのアイデアを受け取りました。ありがとうございます！</p>
                    <p className="mt-6 text-left whitespace-pre-wrap break-words bg-black/50 border border-white/10 p-4 text-white/70 text-sm">
                        <span className="text-white/40 text-xs font-bold mr-2">[{category}]</span>{sentText}
                    </p>
                    <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            type="button"
                            onClick={() => setIsSuccess(false)}
                            className="px-8 py-4 bg-white text-black text-sm font-black tracking-widest hover:bg-[#FF4655] hover:text-white transition-colors"
                        >
                            もう1件送る
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate("/")}
                            className="px-8 py-4 border border-white/30 text-white/80 text-sm font-black tracking-widest hover:border-white hover:text-white transition-colors"
                        >
                            トップへ戻る
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        /* ✅ pb-20 を pb-4 に変更して、コンテナの下側の余白を最小限に */
        <div className="animate-fade-in max-w-4xl mx-auto pb-4 px-4">
            <button
                onClick={onBack}
                className="mb-10 flex items-center gap-2 text-gray-400 hover:text-white transition-colors uppercase text-xs font-black tracking-[0.3em]"
            >
                ← Back
            </button>

            <div className="border-l-[6px] border-[#FF4655] pl-8 mb-12">
                <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter leading-none">
                    Suggest a <span className="text-[#FF4655]">Bind</span>
                </h2>
                <p className="text-gray-500 text-[10px] uppercase tracking-[0.4em] mt-3 font-bold opacity-70">Submit your protocol ideas to the archive</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8 bg-black/40 p-8 md:p-12 border border-white/5 rounded-sm shadow-2xl backdrop-blur-sm">
                <div>
                    <label className="block text-xs font-black uppercase tracking-[0.25em] text-gray-400 mb-5">
                        Rarity Category
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {['CHAOS', 'Epic', 'Exotic', 'Extra', 'Special', 'Unique'].map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setCategory(cat)}
                                className={`py-4 text-xs font-black border transition-all duration-300 tracking-widest uppercase ${
                                    category === cat 
                                    ? getCategoryStyles(cat)
                                    : 'border-white/10 text-gray-500 hover:border-white/30 hover:bg-white/5'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-black uppercase tracking-[0.25em] text-gray-400 mb-5">
                        Bind Content
                    </label>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="例: 全員ハンドガンのみで戦え"
                        className="w-full bg-black/60 border border-white/10 p-6 text-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF4655] transition-colors min-h-[180px] resize-none leading-relaxed"
                        maxLength={500}
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full py-6 text-sm font-black uppercase tracking-[0.6em] transition-all ${
                        isSubmitting
                        ? 'bg-gray-800 text-gray-300'
                        : 'bg-white text-black hover:bg-[#FF4655] hover:text-white shadow-[0_0_30px_rgba(255,255,255,0.1)] active:scale-[0.99]'
                    }`}
                >
                    {isSubmitting ? '送信中…' : 'Send to Archive'}
                </button>

                {error && (
                    <p role="alert" className="mt-2 text-center text-[#FF6B76] text-sm font-bold">
                        {error}
                    </p>
                )}
            </form>

            {/* ✅ mt-16 を mt-6 に縮小して、共通フッターに近づけました */}
            <div className="mt-6 text-center">
                <button 
                    onClick={() => navigate("/")} 
                    className="text-xs text-white/60 hover:text-white underline transition-colors uppercase tracking-[0.3em] font-bold"
                >
                    ← Back to HOME
                </button>
            </div>
        </div>
    );
}