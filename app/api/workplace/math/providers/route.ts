import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const available: string[] = [];
  if (process.env.ANTHROPIC_API_KEY) available.push('anthropic');
  if (process.env.DEEPSEEK_API_KEY) available.push('deepseek');
  if (process.env.COZE_API_KEY && process.env.COZE_BOT_ID) available.push('coze');
  return NextResponse.json({ available });
}
