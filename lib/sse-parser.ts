// SSE reply parser shared by chat API routes.
// AstrBot returns SSE with "data:"-prefixed JSON lines.
// This joins all "plain" type chunks into a single reply string.
export function parseSseReply(raw: string): string {
  const parts: string[] = [];
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data:')) continue;
    try {
      const json = JSON.parse(line.slice(5).trim()) as Record<string, unknown>;
      if (json.type === 'plain' && typeof json.data === 'string' && json.data) {
        parts.push(json.data);
      }
    } catch { /* skip malformed lines */ }
  }
  return parts.join('');
}
