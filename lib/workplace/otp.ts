import { saveOtp, verifyOtpDb } from './db';

type OTPEntry = { code: string; exp: number };
const store = new Map<string, OTPEntry>();
const CODE_TTL_MS = 10 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  for (const [k, v] of store) if (v.exp < now) store.delete(k);
}

export async function generateOTP(phone: string): Promise<string> {
  cleanup();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const persisted = await saveOtp(phone, code, CODE_TTL_MS);
  if (!persisted) store.set(phone, { code, exp: Date.now() + CODE_TTL_MS }); // fallback
  return code;
}

export async function verifyOTP(phone: string, code: string): Promise<boolean> {
  const dbResult = await verifyOtpDb(phone, code);
  if (dbResult !== null) return dbResult; // DB authoritative
  // fallback to in-memory
  cleanup();
  const entry = store.get(phone);
  if (!entry || entry.exp < Date.now()) return false;
  if (entry.code !== code) return false;
  store.delete(phone);
  return true;
}
