// 「対戦ロビー」の見た目の共通部品（2026-11-17 決定）
// 色は3つ：攻め＝赤、守り＝青、文字＝生成り。地は暗い炭色。黄色はマップの「今回」だけに使う
// 字間を広げた英字の小見出し・番号付け・飾りの細線は使わない（AIっぽく見えるため）

export const C = {
  bg: '#101418',
  panel: '#1a2027',
  panel2: '#222a33',
  line: '#ffffff14',
  fg: '#ece8e1',
  muted: '#9aa3ad',
  red: '#ff4655',
  blue: '#3fb7ec',
  yellow: '#ffd83b',
} as const;

const btnBase = 'inline-flex items-center justify-center gap-2 font-extrabold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

/** 主ボタン（赤い板） */
export const btnPrimary = `${btnBase} bg-[#ff4655] text-white hover:bg-[#ff5e6b] px-8 py-4 text-lg`;
/** 副ボタン（生成りの板） */
export const btnLight = `${btnBase} bg-[#ece8e1] text-[#101418] hover:bg-white px-8 py-4 text-lg`;
/** 控えめなボタン（枠だけ） */
export const btnGhost = `${btnBase} border border-white/20 text-[#ece8e1] hover:bg-white/5 px-4 py-2 text-sm`;
/** 守りの青ボタン */
export const btnBlue = `${btnBase} bg-[#3fb7ec] text-[#101418] hover:bg-[#62c6f0] px-8 py-4 text-lg`;

/** 平たいパネル */
export const panel = 'bg-[#1a2027]';
/** ページの見出し */
export const pageTitle = 'text-3xl md:text-4xl font-extrabold';
/** 戻るリンク */
export const backLink = 'inline-flex items-center gap-2 text-sm font-bold text-[#9aa3ad] hover:text-[#ece8e1] transition-colors';
