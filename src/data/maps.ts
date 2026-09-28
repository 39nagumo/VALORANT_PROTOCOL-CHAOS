export interface MapInfo {
  id: string;
  name: string;
  file: string;
}

// 並びはゲーム内の「マップを選択」画面と同じ
export const MAPS: MapInfo[] = [
  { id: 'icebox', name: 'ICEBOX', file: 'map_05_Icebox' },
  { id: 'ascent', name: 'ASCENT', file: 'map_01_Ascent' },
  { id: 'abyss', name: 'ABYSS', file: 'map_11_Abyss' },
  { id: 'corrode', name: 'CORRODE', file: 'map_12_Corrode' },
  { id: 'summit', name: 'SUMMIT', file: 'map_13_Summit' },
  { id: 'sunset', name: 'SUNSET', file: 'map_10_Sunset' },
  { id: 'split', name: 'SPLIT', file: 'map_04_Split' },
  { id: 'pearl', name: 'PEARL', file: 'map_08_Pearl' },
  { id: 'bind', name: 'BIND', file: 'map_02_Bind' },
  { id: 'fracture', name: 'FRACTURE', file: 'map_07_Fracture' },
  { id: 'breeze', name: 'BREEZE', file: 'map_06_Breeze' },
  { id: 'haven', name: 'HAVEN', file: 'map_03_Haven' },
  { id: 'lotus', name: 'LOTUS', file: 'map_09_Lotus' }
];

export const mapImage = (m: MapInfo) => `/assets/maps/${m.file}.png`;
