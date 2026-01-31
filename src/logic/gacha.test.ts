import { describe, it, expect } from 'vitest';
import { GachaSystem } from './gacha';

describe('GachaSystem', () => {
    const system = new GachaSystem(12345); // Fixed seed

    it('should generate 5 players', () => {
        const result = system.runGacha(['A', 'B', 'C', 'D', 'E']);
        expect(result.players).toHaveLength(5);
    });

    it('should have exactly 1 of each role + 1 extra', () => {
        const result = system.runGacha(['1', '2', '3', '4', '5']);
        const roleCounts = {
            Duelist: 0,
            Initiator: 0,
            Controller: 0,
            Sentinel: 0
        };

        result.players.forEach(p => {
            roleCounts[p.agent.role]++;
        });

        // Check minimums
        expect(roleCounts.Duelist).toBeGreaterThanOrEqual(1);
        expect(roleCounts.Initiator).toBeGreaterThanOrEqual(1);
        expect(roleCounts.Controller).toBeGreaterThanOrEqual(1);
        expect(roleCounts.Sentinel).toBeGreaterThanOrEqual(1);

        // Sum should be 5
        const sum = Object.values(roleCounts).reduce((a, b) => a + b, 0);
        expect(sum).toBe(5);
    });

    it('should ensure all agents are unique', () => {
        const result = system.runGacha(['1', '2', '3', '4', '5']);
        const names = result.players.map(p => p.agent.name);
        const uniqueNames = new Set(names);
        expect(uniqueNames.size).toBe(5);
    });

    it('should include strictly 5 binds with correct distribution', () => {
        const result = system.runGacha(['1', '2', '3', '4', '5']);
        expect(result.binds).toHaveLength(5);

        const chaos = result.binds.filter(b => b.rarity === 'CHAOS');
        const mid = result.binds.filter(b => ['Epic', 'Exotic', 'Extra'].includes(b.rarity));
        const rare = result.binds.filter(b => ['Unique', 'Hidden'].includes(b.rarity));

        expect(chaos).toHaveLength(1);
        expect(mid).toHaveLength(3);
        expect(rare).toHaveLength(1);
    });

    it('should reproduce results with same seed', () => {
        const s1 = new GachaSystem(999);
        const s2 = new GachaSystem(999);

        const r1 = s1.runGacha(['P1']);
        const r2 = s2.runGacha(['P1']);

        expect(r1.players[0].agent.name).toBe(r2.players[0].agent.name);
        expect(r1.binds[0].text).toBe(r2.binds[0].text);
    });
});
