type OTPEntry = { code: string; exp: number };

const store = new Map<string, OTPEntry>();
const CODE_TTL_MS = 10 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.exp < now) store.delete(k);
  }
}

export function generateOTP(phone: string): string {
  cleanup();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  store.set(phone, { code, exp: Date.now() + CODE_TTL_MS });
  return code;
}

export function verifyOTP(phone: string, code: string): boolean {
  cleanup();
  const entry = store.get(phone);
  if (!entry || entry.exp < Date.now()) return false;
  if (entry.code !== code) return false;
  store.delete(phone);
  return true;
}
