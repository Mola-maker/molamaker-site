import { createHmac } from 'crypto';
import { logError } from '@/lib/logger';

// Aliyun SMS (阿里云短信 / dysmsapi) sender for the Workplace phone-OTP login.
// Dependency-free: signs the SendSms RPC request by hand (HMAC-SHA1, signature
// version 1.0) the same way the official SDK does, so we avoid pulling in the
// heavy @alicloud/* packages just to deliver a 6-digit code.

const ACCESS_KEY_ID = process.env.ALIYUN_SMS_ACCESS_KEY_ID ?? '';
const ACCESS_KEY_SECRET = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET ?? '';
const SIGN_NAME = process.env.ALIYUN_SMS_SIGN_NAME ?? '';
const TEMPLATE_CODE = process.env.ALIYUN_SMS_TEMPLATE_CODE ?? '';
const ENDPOINT = 'https://dysmsapi.aliyuncs.com/';

/** True only when all four Aliyun credentials are present. */
export function isSmsConfigured(): boolean {
  return Boolean(ACCESS_KEY_ID && ACCESS_KEY_SECRET && SIGN_NAME && TEMPLATE_CODE);
}

// Aliyun RPC percent-encoding: leave unreserved set (A-Za-z0-9-_.~) untouched,
// encode everything else. encodeURIComponent already leaves -_.!~*'(); we just
// have to additionally encode !*'() to match Aliyun's canonicalization.
function pe(s: string): string {
  return encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

type SmsResult = { sent: true } | { sent: false; reason: string };

/**
 * Send the OTP `code` to `phone` via Aliyun SMS.
 *
 * `phone` is the bare national number (e.g. 13800000000) for mainland China.
 * Returns { sent: false, reason: 'not_configured' } when credentials are
 * missing so the caller can fall back to the dev debug-code flow.
 */
export async function sendOtpSms(phone: string, code: string): Promise<SmsResult> {
  if (!isSmsConfigured()) return { sent: false, reason: 'not_configured' };

  const params: Record<string, string> = {
    AccessKeyId: ACCESS_KEY_ID,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: phone,
    RegionId: 'cn-hangzhou',
    SignName: SIGN_NAME,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: `${Date.now()}${Math.random().toString(36).slice(2)}`,
    SignatureVersion: '1.0',
    TemplateCode: TEMPLATE_CODE,
    TemplateParam: JSON.stringify({ code }),
    // ISO8601 UTC without milliseconds, e.g. 2024-01-01T00:00:00Z
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2017-05-25',
  };

  // Canonicalized, sorted query string — reused verbatim for both the signature
  // and the request URL so what we sign is exactly what we send.
  const canonical = Object.keys(params)
    .sort()
    .map((k) => `${pe(k)}=${pe(params[k])}`)
    .join('&');
  const stringToSign = `GET&${pe('/')}&${pe(canonical)}`;
  const signature = createHmac('sha1', `${ACCESS_KEY_SECRET}&`).update(stringToSign).digest('base64');

  try {
    const res = await fetch(`${ENDPOINT}?Signature=${pe(signature)}&${canonical}`, { method: 'GET' });
    const data = (await res.json()) as { Code?: string; Message?: string };
    if (data.Code === 'OK') return { sent: true };
    const reason = data.Code ?? data.Message ?? `http_${res.status}`;
    logError('workplace-sms', `Aliyun SendSms rejected: ${reason}`, data);
    return { sent: false, reason };
  } catch (err) {
    logError('workplace-sms', 'Aliyun SendSms request failed', err);
    return { sent: false, reason: 'network_error' };
  }
}
