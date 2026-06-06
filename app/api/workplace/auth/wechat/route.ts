import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, setSessionCookie } from '@/lib/workplace/session';
import { getOrCreateUser, writeAudit } from '@/lib/workplace/db';

export const runtime = 'nodejs';

const APP_ID = process.env.WECHAT_APP_ID ?? '';
const APP_SECRET = process.env.WECHAT_APP_SECRET ?? '';
const REDIRECT_URI = process.env.WECHAT_REDIRECT_URI ?? '';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const action = searchParams.get('action');
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Step 1: return QR auth URL for the frontend to display
  if (action === 'qr') {
    if (!APP_ID || !REDIRECT_URI) {
      return NextResponse.json({ error: 'WeChat not configured — set WECHAT_APP_ID and WECHAT_REDIRECT_URI' }, { status: 503 });
    }
    const st = Math.random().toString(36).slice(2);
    const url = `https://open.weixin.qq.com/connect/qrconnect?appid=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=snsapi_login&state=${st}#wechat_redirect`;
    return NextResponse.json({ ok: true, data: { url, state: st } });
  }

  // Step 2: OAuth callback (WeChat redirects here with code+state)
  if (code && state) {
    if (!APP_ID || !APP_SECRET) {
      return NextResponse.redirect(new URL('/?variant=workplace&error=wechat_not_configured', req.url));
    }

    // Exchange code for access_token + openid
    const tokenRes = await fetch(
      `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${APP_ID}&secret=${APP_SECRET}&code=${code}&grant_type=authorization_code`
    );
    const tokenData = await tokenRes.json() as { access_token?: string; openid?: string; errcode?: number };
    if (!tokenData.access_token || !tokenData.openid) {
      return NextResponse.redirect(new URL('/?variant=workplace&error=wechat_auth_failed', req.url));
    }

    // Fetch user info
    const userRes = await fetch(
      `https://api.weixin.qq.com/sns/userinfo?access_token=${tokenData.access_token}&openid=${tokenData.openid}&lang=zh_CN`
    );
    const userData = await userRes.json() as { nickname?: string; headimgurl?: string; errcode?: number };

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const name = userData.nickname ?? tokenData.openid;
    const { id: userId, role } = await getOrCreateUser({ name, wechatOpenId: tokenData.openid, ip, authMethod: 'wechat' });
    const token = createSessionToken({
      userId,
      name,
      wechatOpenId: tokenData.openid,
      ip,
      role,
    });

    await writeAudit({ action: 'login', userId, userName: name, ip });

    const res = NextResponse.redirect(new URL('/?variant=workplace', req.url));
    return setSessionCookie(res, token, req);
  }

  return NextResponse.json({ error: 'missing params' }, { status: 400 });
}
