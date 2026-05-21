import { createHmac } from 'crypto';

function getSecret(): string {
  const secret = process.env.HMAC_IP_SECRET;
  if (!secret) {
    throw new Error('HMAC_IP_SECRET environment variable is required');
  }
  return secret;
}

export function hashIp(ip: string): string {
  return createHmac('sha256', getSecret()).update(ip).digest('hex').slice(0, 16);
}
