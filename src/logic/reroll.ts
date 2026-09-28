import agentsData from '../data/agents.json';
import bindsData from '../data/binds.json';
import type { Agent, Bind, BindRarity } from './gacha';

// 結果画面の「1人だけ振り直し」と同じルール（ルーム側でも使うため関数として切り出し）
const ALL_AGENTS = agentsData as Agent[];
const ALL_BINDS: Bind[] = Object.entries(bindsData).flatMap(([rarity, texts]) =>
  (texts as string[]).map(text => ({ text, rarity: rarity as BindRarity }))
);

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** 同じロールで、自分以外のチームメイトと被らないエージェントに引き直す。候補がなければ null */
export function rerollAgent(current: Agent, teammates: Agent[]): Agent | null {
  const taken = teammates.map(a => a.name);
  const candidates = ALL_AGENTS.filter(a =>
    a.role === current.role && a.name !== current.name && !taken.includes(a.name)
  );
  return candidates.length ? pick(candidates) : null;
}

/** 同じレア度で、チーム内の他の縛りと被らない縛りに引き直す。候補がなければ null */
export function rerollBind(current: Bind, teammates: Bind[]): Bind | null {
  const taken = teammates.map(b => b.text);
  const candidates = ALL_BINDS.filter(b =>
    b.rarity === current.rarity && b.text !== current.text && !taken.includes(b.text)
  );
  return candidates.length ? pick(candidates) : null;
}

/** 演出でスロットを回すときに流す顔ぶれ（同じロールのエージェント） */
export function agentsOfRole(role: Agent['role']): Agent[] {
  return ALL_AGENTS.filter(a => a.role === role);
}

/** 演出で文字を回すときに流す縛り（同じレア度のもの） */
export function bindsOfRarity(rarity: BindRarity): Bind[] {
  return ALL_BINDS.filter(b => b.rarity === rarity);
}
