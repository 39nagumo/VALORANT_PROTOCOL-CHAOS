import { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { submitBind } from '../room/connection';
import { backLink, btnGhost, btnLight, btnPrimary, pageTitle } from '../ui/lobby';

interface Props {
    onBack: () => void;
}

const RARITIES = ['CHAOS', 'Epic', 'Exotic', 'Extra', 'Special', 'Unique'];

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
            case 'CHAOS': return 'bg-red-500 text-white';
            case 'Epic': return 'bg-purple-500 text-white';
            case 'Exotic': return 'bg-green-500 text-[#101418]';
            case 'Extra': return 'bg-yellow-500 text-[#101418]';
            case 'Unique': return 'bg-pink-500 text-white';
            case 'Special': return 'bg-cyan-400 text-[#101418]';
            default: return 'bg-blue-500 text-white';
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
            <div className="animate-fade-in max-w-3xl mx-auto pb-4 px-4">
                <h2 className={`${pageTitle} mt-10 mb-8`}>縛りを投稿</h2>
                <div className="bg-[#1a2027] border-t-[6px] border-[#3fb7ec] p-8 md:p-12 text-center">
                    <p className="text-[#3fb7ec] text-2xl md:text-3xl font-extrabold">✓ 送信しました</p>
                    <p className="mt-4 text-[#ece8e1]/80 text-sm md:text-base font-bold">縛りのアイデアを受け取りました。ありがとうございます！</p>
                    <p className="mt-6 text-left whitespace-pre-wrap break-words bg-[#101418] p-4 text-[#ece8e1]/80 text-sm">
                        <span className="text-[#9aa3ad] text-xs font-bold mr-2">[{category}]</span>{sentText}
                    </p>
                    <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                        <button type="button" onClick={() => setIsSuccess(false)} className={btnLight}>
                            もう1件送る
                        </button>
                        <button type="button" onClick={() => navigate("/")} className={btnGhost.replace('px-4 py-2 text-sm', 'px-8 py-4 text-lg')}>
                            トップへ戻る
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in max-w-3xl mx-auto pb-4 px-4">
            <button onClick={onBack} className={`${backLink} mb-3`}>
                ← 戻る
            </button>

            <h2 className={pageTitle}>縛りを投稿</h2>
            <p className="text-sm text-[#9aa3ad] mt-2 mb-8">思いついた縛りを送ってください。採用したら一覧に追加します。</p>

            <form onSubmit={handleSubmit} className="bg-[#1a2027] p-6 md:p-10 flex flex-col gap-8">
                <div>
                    <label className="block text-base font-extrabold text-[#ece8e1] mb-3">
                        レアリティ
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {RARITIES.map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setCategory(cat)}
                                className={`h-12 flex items-center justify-center text-base font-extrabold transition-colors ${
                                    category === cat
                                    ? getCategoryStyles(cat)
                                    : 'bg-[#101418] text-[#9aa3ad] hover:text-[#ece8e1]'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-base font-extrabold text-[#ece8e1] mb-3">
                        縛りの内容
                    </label>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="例: 全員ハンドガンのみで戦え"
                        className="w-full bg-[#101418] border-l-[6px] border-[#ff4655] p-5 text-lg text-[#ece8e1] placeholder:text-[#9aa3ad]/50 focus:outline-none focus:bg-[#151b21] transition-colors min-h-[180px] resize-none leading-relaxed"
                        maxLength={500}
                        required
                    />
                </div>

                <div>
                    <button type="submit" disabled={isSubmitting} className={`${btnPrimary} w-full`}>
                        {isSubmitting ? '送信中…' : '送信する'}
                    </button>

                    {error && (
                        <p role="alert" className="mt-3 text-center text-[#ff6b76] text-sm font-bold">
                            {error}
                        </p>
                    )}
                </div>
            </form>

            <div className="mt-6 text-center">
                <button onClick={() => navigate("/")} className={backLink}>
                    トップへ戻る
                </button>
            </div>
        </div>
    );
}
