import { createHmac, randomBytes } from 'crypto';
import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const SECRET = process.env.WORKPLACE_SESSION_SECRET ?? 'dev-secret-please-set-in-env';
const COOKIE = 'wp-session';
const TTL_MS = 24 * 60 * 60 * 1000;

export type WPSession = {
  userId: string;
  name: string;
  phone?: string;
  wechatOpenId?: string;
  email?: string;
  ip?: string;
  role: 'owner' | 'admin' | 'contributor' | 'viewer';
  exp: number;
};

function sign(payload: object): string {
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

function verify(token: string): WPSession | null {
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const b64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac('sha256', SECRET).update(b64).digest('base64url');
  if (sig !== expected) return null;
  try {
    const p = JSON.parse(Buffer.from(b64, 'base64url').toString()) as WPSession;
    if (p.exp < Date.now()) return null;
    return p;
  } catch { return null; }
}

export function createSessionToken(session: Omit<WPSession, 'exp'>): string {
  return sign({ ...session, exp: Date.now() + TTL_MS });
}

export function setSessionCookie(res: NextResponse, token: string, req?: NextRequest): NextResponse {
  // Nginx sends x-forwarded-proto; use it to decide secure flag (don't blindly
  // trust NODE_ENV — the site may be proxied over HTTP even in production).
  const isSecure = req?.headers.get('x-forwarded-proto') === 'https';
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: TTL_MS / 1000,
    path: '/',
    secure: isSecure,
  });
  return res;
}

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.delete(COOKIE);
  return res;
}

export async function getWPSession(): Promise<WPSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return verify(token);
}

export function generateUserId(): string {
  return randomBytes(12).toString('hex');
}
