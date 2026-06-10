import { NextResponse } from 'next/server';

/** Success envelope: `{ data: T }` */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

/** Error envelope: `{ error: { code, message?, ...extra } }` */
export function err(
  code: string,
  message?: string,
  status = 400,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}
