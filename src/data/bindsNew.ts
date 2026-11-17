import binds from './binds.json';

// 縛り一覧で「NEW」の札を付ける縛り（2026-11-17 追加）。しばらくしたらここから外す
const NEW_BINDS: Record<string, number[]> = {
  // binds.json の各レアリティの中での位置（0 から数える）を、文の先頭で探して決める
};
const NEW_HEADS = [
  '連射武器縛り',
  '【ガンマン】',
  '名前を呼ばれたら',
  'リロードする度に',
  'シールドは',
  'あだ名縛り。',
  '報告は【すべて敬語】',
  '【マグロの宿命】',
  '【守護者】',
  '【脳筋】',
  '消音器つき武器縛り',
  'あなたはシンデレラ。',
  'ラッキーラウンド！',
];

for (const [rarity, list] of Object.entries(binds as Record<string, string[]>)) {
  NEW_BINDS[rarity] = list.flatMap((text, i) => (NEW_HEADS.some(h => text.startsWith(h)) ? [i] : []));
}

export const isNewBind = (rarity: string, index: number) => NEW_BINDS[rarity]?.includes(index) ?? false;
