import { UID_PATTERN } from '../logic/room';

// このブラウザ（またはOBS）を表す秘密のID。OBS用URLの末尾になる
const UID_KEY = 'chaos-gacha:uid';
const NAME_KEY = 'chaos-gacha:name';

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, v: string) => { try { localStorage.setItem(key, v); } catch { /* 保存できない環境 */ } };

export function getUid(): string {
  const saved = read(UID_KEY);
  if (saved && UID_PATTERN.test(saved)) return saved;
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const uid = Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
  write(UID_KEY, uid);
  return uid;
}

/** 別のPCで使っていたOBS用URL（または末尾の英数字）を引き継ぐ */
export function adoptUid(input: string): boolean {
  const uid = input.trim().split('/').filter(Boolean).pop()?.split('?')[0]?.toLowerCase() ?? '';
  if (!UID_PATTERN.test(uid)) return false;
  write(UID_KEY, uid);
  return true;
}

export const getSavedName = () => read(NAME_KEY) ?? '';
export const saveName = (name: string) => write(NAME_KEY, name);

export const overlayUrl = (uid: string) => `${location.origin}/me/${uid}`;
