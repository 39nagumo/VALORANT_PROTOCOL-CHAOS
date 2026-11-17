import { useState } from 'react';
import { btnPrimary } from '../ui/lobby';

interface Props {
    onSubmit: (names: string[]) => void;
    loading: boolean;
    initialNames?: string[];
}

export function GachaForm({ onSubmit, loading, initialNames }: Props) {
    const [names, setNames] = useState<string[]>(() => initialNames ? initialNames.map(n => (/^Player \d$/.test(n) ? "" : n)) : ["", "", "", "", ""]);

    const handleChange = (index: number, val: string) => {
        const newNames = [...names];
        newNames[index] = val;
        setNames(newNames);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Fill empty names
        const finalNames = names.map((n, i) => n.trim() || `Player ${i + 1}`);
        onSubmit(finalNames);
    };

    return (
        <div className="bg-[#1a2027] p-6 md:p-8">
            <h2 className="text-2xl md:text-3xl font-extrabold mb-1">メンバーを入れる</h2>
            <p className="text-sm text-[#9aa3ad] mb-6">5人の名前を入れて回します。空いた所は「Player 1」などになります。</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                {names.map((name, i) => (
                    <input
                        key={i}
                        type="text"
                        value={name}
                        onChange={(e) => handleChange(i, e.target.value)}
                        placeholder={`Player ${i + 1}`}
                        aria-label={`${i + 1}人目の名前`}
                        className="w-full h-14 bg-[#101418] border-l-[6px] border-[#ff4655] text-[#ece8e1] px-4 text-lg font-bold outline-none placeholder:text-[#9aa3ad]/50 focus:bg-[#222a33] transition-colors"
                    />
                ))}

                <button
                    type="submit"
                    disabled={loading}
                    className={`${btnPrimary} w-full mt-6`}
                >
                    {loading ? (
                        <>
                            <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                            抽選中…
                        </>
                    ) : (
                        'ガチャを回す'
                    )}
                </button>
            </form>
        </div>
    );
}
