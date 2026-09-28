export interface MapInfo {
  id: string;
  name: string;
  file: string;
}

export const MAPS: MapInfo[] = [
  { id: 'ascent', name: 'ASCENT', file: 'map_01_Ascent' },
  { id: 'bind', name: 'BIND', file: 'map_02_Bind' },
  { id: 'haven', name: 'HAVEN', file: 'map_03_Haven' },
  { id: 'split', name: 'SPLIT', file: 'map_04_Split' },
  { id: 'icebox', name: 'ICEBOX', file: 'map_05_Icebox' },
  { id: 'breeze', name: 'BREEZE', file: 'map_06_Breeze' },
  { id: 'fracture', name: 'FRACTURE', file: 'map_07_Fracture' },
  { id: 'pearl', name: 'PEARL', file: 'map_08_Pearl' },
  { id: 'lotus', name: 'LOTUS', file: 'map_09_Lotus' },
  { id: 'sunset', name: 'SUNSET', file: 'map_10_Sunset' },
  { id: 'abyss', name: 'ABYSS', file: 'map_11_Abyss' },
  { id: 'corrode', name: 'CORRODE', file: 'map_12_Corrode' },
  { id: 'summit', name: 'SUMMIT', file: 'map_13_Summit' }
];

export const mapImage = (m: MapInfo) => `/assets/maps/${m.file}.png`;
