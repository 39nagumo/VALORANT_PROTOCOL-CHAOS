import agentsData from '../data/agents.json';
import bindsData from '../data/binds.json';

export type AgentRole = 'Duelist' | 'Initiator' | 'Controller' | 'Sentinel';
export type BindRarity = 'CHAOS' | 'Epic' | 'Exotic' | 'Unique' | 'Special' | 'Extra';

export interface Agent {
  name: string;
  role: AgentRole;
  image: string;
}

export interface Bind {
  text: string;
  rarity: BindRarity;
}

export interface PlayerResult {
  id: string;
  playerName: string;
  agent: Agent;
}

export interface GachaResult {
  players: PlayerResult[];
  binds: Bind[];
  seed: string;
  allAgentsPool?: Agent[];
  allBindsPool?: Bind[];
}

export class GachaSystem {
  private agents: Agent[] = agentsData as Agent[];
  private binds: Bind[] = Object.entries(bindsData).flatMap(([rarity, texts]) => 
    (texts as string[]).map(text => ({ text, rarity: rarity as BindRarity }))
  );

  public getBindPoolByRarity(rarity: BindRarity): Bind[] {
    return this.binds.filter(b => b.rarity === rarity);
  }

  runGacha(playerNames: string[], lockedBinds?: { index: number, bind: Bind }[]): GachaResult {
    const players: PlayerResult[] = [];
    const selectedAgents = new Set<string>();
    const finalBinds: Bind[] = new Array(5);

    const coreRarities: BindRarity[] = ["CHAOS", "Epic", "Exotic", "Unique"];
    const lockedMap = new Map<number, Bind>();
    
    if (lockedBinds) {
      lockedBinds.forEach(lb => {
        lockedMap.set(lb.index, lb.bind);
        finalBinds[lb.index] = lb.bind;
      });
    }

    const lockedSpecialOrExtra = Array.from(lockedMap.values()).find(b => b.rarity === "Special" || b.rarity === "Extra");
    let selectedSpecialOrExtra: BindRarity;
    
    if (lockedSpecialOrExtra) {
      selectedSpecialOrExtra = lockedSpecialOrExtra.rarity;
    } else {
      selectedSpecialOrExtra = Math.random() > 0.5 ? "Special" : "Extra";
    }

    const targetRarities = [...coreRarities, selectedSpecialOrExtra];
    const usedRarities = Array.from(lockedMap.values()).map(b => b.rarity);
    const availableRarities = [...targetRarities].filter(r => {
      const index = usedRarities.indexOf(r);
      if (index !== -1) {
        usedRarities.splice(index, 1);
        return false;
      }
      return true;
    }).sort(() => Math.random() - 0.5);

    for (let i = 0; i < 5; i++) {
      if (!lockedMap.has(i)) {
        const rarity = availableRarities.shift();
        if (rarity) {
          const pool = this.getBindPoolByRarity(rarity);
          finalBinds[i] = pool[Math.floor(Math.random() * pool.length)];
        }
      }
    }

    const baseRoles: AgentRole[] = ["Duelist", "Initiator", "Controller", "Sentinel"];
    const extraRole = baseRoles[Math.floor(Math.random() * baseRoles.length)];
    const finalRoleList = [...baseRoles, extraRole].sort(() => Math.random() - 0.5);

    playerNames.forEach((name, i) => {
      const role = finalRoleList[i];
      const pool = this.agents.filter(a => a.role === role && !selectedAgents.has(a.name));
      const agent = pool[Math.floor(Math.random() * pool.length)];
      selectedAgents.add(agent.name);

      players.push({
        id: `p-${i}-${Date.now()}-${Math.random()}`,
        playerName: name,
        agent
      });
    });

    return {
      players,
      binds: finalBinds,
      seed: Math.random().toString(36).substring(2, 9).toUpperCase(),
      allAgentsPool: this.agents,
      allBindsPool: this.binds
    };
  }
}