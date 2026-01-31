import { useState } from 'react';

interface Props {
    onSubmit: (names: string[]) => void;
    loading: boolean;
}

export function GachaForm({ onSubmit, loading }: Props) {
    const [names, setNames] = useState<string[]>(['', '', '', '', '']);

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
        <div className="bg-[#1F2631] border border-[#FF4655]/30 p-6 md:p-8 rounded-sm shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-opacity-90 backdrop-blur-sm relative overflow-hidden">
            {/* Decorative borders */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[#FF4655]" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-[#FF4655]" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-[#FF4655]" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[#FF4655]" />

            <h2 className="text-xl font-bold mb-6 text-center uppercase tracking-wider text-white">
                Enter Squad Members
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
                {names.map((name, i) => (
                    <div key={i} className="relative group">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm">
                            0{i + 1}
                        </span>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => handleChange(i, e.target.value)}
                            placeholder={`Player ${i + 1}`}
                            className="w-full bg-[#0F1923] border border-gray-600 text-white pl-10 pr-4 py-3 focus:border-[#FF4655] focus:ring-1 focus:ring-[#FF4655] outline-none transition-all placeholder-gray-700 font-bold tracking-wide skew-x-[-10deg] md:skew-x-0"
                        />
                    </div>
                ))}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-8 bg-[#FF4655] hover:bg-[#D93645] text-white font-black py-4 px-8 uppercase tracking-widest transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_0_#9d1c28]"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                            Initialising...
                        </span>
                    ) : (
                        'INITIATE PROTOCOL // GACHA'
                    )}
                </button>
            </form>
        </div>
    );
}
