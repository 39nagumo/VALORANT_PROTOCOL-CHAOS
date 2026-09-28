import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import agents from '../data/agents.json';
import binds from '../data/binds.json';
import type { Agent, BindRarity } from '../logic/gacha';
import type { RoomEvent, Side, TeamRoll } from '../logic/room';
import { MAPS } from '../data/maps';
import { MapReveal, MyCard, Stage, TeamReveal } from './reveal';

// 開発中だけ使う見た目の確認ページ（/dev/reveal?kind=team&t=5000）。本番ビルドには入らない
const pickAgent = (name: string) => (agents as Agent[]).find(a => a.name === name)!;
const b = (rarity: BindRarity, i = 0) => ({ rarity, text: (binds as Record<string, string[]>)[rarity][i] });
const NAMES = ['なぐも', 'ねこまる', 'Kaze', 'しおり', 'たぬき'];
const sample = (side: Side): TeamRoll => ({
  side,
  slots: [
    [pickAgent('ジェット'), b('Epic')], [pickAgent('ブリーチ'), b('CHAOS')], [pickAgent('オーメン'), b('Unique')],
    [pickAgent('キルジョイ'), b('Exotic')], [pickAgent('レイズ'), b('Special', 1)],
  ].map(([agent, bind], i) => ({ memberId: `m${i}`, name: NAMES[i], agent: agent as Agent, bind: bind as TeamRoll['slots'][0]['bind'] })),
});

export function DevPreview() {
  const [p] = useSearchParams();
  const kind = p.get('kind') ?? 'team';
  const t = Number(p.get('t') ?? 0);
  const side = (p.get('side') ?? 'ATK') as Side;
  useEffect(() => { document.body.style.background = p.get('bg') === 'none' ? 'transparent' : '#555'; }, [p]);
  const game = p.get('bg') === 'game';
  const team: RoomEvent & { kind: 'team' } = { kind: 'team', id: 'preview', side, startedAt: 0, by: 'なぐも' };
  const map: RoomEvent & { kind: 'map' } = { kind: 'map', id: 'preview-map', mapId: 'lotus', pool: MAPS.filter(m => m.id !== 'ascent').map(m => m.id), startedAt: 0, by: 'なぐも' };
  const roll = sample(side);
  return (
    <div style={{ position: 'fixed', inset: 0, background: game ? 'linear-gradient(180deg,#4d6275 0%,#8a8f86 45%,#5b574d 46%,#3b3934 100%)' : undefined }}>
      <Stage>
        {game && <div style={{ position: 'absolute', left: 24, top: 24, width: 372, height: 372, background: 'rgba(10,16,22,.72)', border: '2px solid rgba(255,255,255,.3)', color: 'rgba(255,255,255,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>ミニマップ（仮）</div>}
        {kind === 'team' && <TeamReveal roll={roll} event={team} t={t} meId={p.get('me')} />}
        {kind === 'map' && <MapReveal event={map} t={t} />}
        {kind === 'card' && (
          <div style={{ position: 'absolute', left: 24, top: 410 }}>
            <MyCard slot={roll.slots[Number(p.get('i') ?? 1)]} side={side}
              reroll={p.get('reroll') ? { target: p.get('reroll') as 'agent' | 'bind', t, seed: 'x' } : null} />
          </div>
        )}
      </Stage>
    </div>
  );
}
