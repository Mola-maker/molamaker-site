// SSE reply parser shared by chat API routes.
// AstrBot returns SSE with "data:"-prefixed JSON lines.
// This joins all "plain" type chunks into a single reply string and turns any
// attachment segments the bot returns (image/file/record/video) into markdown
// pointing at the same-origin download proxy (/api/astrbot/file).

export const ATTACH_SEGMENT_TYPES = new Set(['image', 'file', 'record', 'video']);

const ATTACH_PREFIX: Record<string, string> = {
  image: '[IMAGE]',
  record: '[RECORD]',
  file: '[FILE]',
  video: '[VIDEO]',
};

/**
 * Resolve a downloadable URL for an attachment segment the bot returned.
 * Accepts an `attachment_id`, a bare filename in `data`/`url` (optionally
 * prefixed with AstrBot's `[IMAGE]`/`[FILE]`/`[RECORD]`/`[VIDEO]` marker), or a
 * full http(s) URL.
 */
export function attachmentUrl(seg: Record<string, unknown>): string | null {
  const type = String(seg.type ?? '');
  const id = typeof seg.attachment_id === 'string' ? seg.attachment_id.trim() : '';

  let raw = '';
  for (const k of ['data', 'url', 'path', 'filename', 'file', 'name'] as const) {
    const v = seg[k];
    if (typeof v === 'string' && v.trim()) { raw = v; break; }
  }

  const prefix = ATTACH_PREFIX[type];
  if (prefix && raw.startsWith(prefix)) raw = raw.slice(prefix.length);
  raw = raw.trim();

  if (/^https?:\/\//i.test(raw)) return raw;
  if (id && /^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    return `/api/astrbot/file?id=${encodeURIComponent(id)}`;
  }
  const ws = workspaceRelativeFromPath(raw);
  if (ws) return `/api/astrbot/file?ws=${encodeURIComponent(ws)}`;
  const base = raw.split(/[/\\]/).pop() ?? '';
  if (base && !base.includes('..') && /^[^\s/\\][^/\\]{0,150}$/.test(base)) {
    return `/api/astrbot/file?name=${encodeURIComponent(base)}`;
  }
  return null;
}

/** `data/workspaces/<umo>/<file>` relative to AstrBot data root. */
export function workspaceRelativeFromPath(raw: string): string | null {
  const m = raw.match(/(?:^|\/)data\/workspaces\/([^/\\]+(?:[/\\][^/\\]+)?)\s*$/i);
  if (!m) return null;
  const rel = m[1].replace(/\\/g, '/');
  if (!/^webchat_FriendMessage_[a-zA-Z0-9_!.@-]+\/[^/\\]+$/.test(rel)) return null;
  if (rel.includes('..')) return null;
  return rel;
}

function attachmentLabel(seg: Record<string, unknown>, rawHint: string): string {
  const base = rawHint.split(/[/\\]/).pop() ?? '';
  if (base) return base.replace(/^\[(?:IMAGE|FILE|RECORD|VIDEO)\]/i, '');
  return String(seg.type ?? 'file');
}

/** Markdown for an attachment segment, or '' if it can't be resolved. */
export function attachmentMarkdown(seg: Record<string, unknown>): string {
  const type = String(seg.type ?? 'file');
  let raw = '';
  for (const k of ['path', 'filename', 'url', 'data', 'file', 'name'] as const) {
    const v = seg[k];
    if (typeof v === 'string' && v.trim()) { raw = v; break; }
  }
  const prefix = ATTACH_PREFIX[type];
  if (prefix && raw.startsWith(prefix)) raw = raw.slice(prefix.length);
  raw = raw.trim();

  const label = attachmentLabel(seg, raw);
  const url = attachmentUrl(seg);
  if (!url) {
    if (workspaceRelativeFromPath(raw)) {
      return `\n\n⚠️ **${label}** couldn't be loaded — AstrBot returned a workspace file path with no downloadable id. Open it from the AstrBot WebUI, or ask the bot to resend it.\n\n`;
    }
    return '';
  }
  const mdUrl = url.replace(/\)/g, '%29').replace(/\(/g, '%28');
  return type === 'image'
    ? `\n\n![${label}](${mdUrl})\n\n`
    : `\n\n[📎 ${label}](${mdUrl})\n\n`;
}

/** Remove AstrBot transport/persona markers from user-facing text. */
export function cleanAstrBotText(text: string, options: { trim?: boolean } = {}): string {
  const cleaned = text
    // Marker + filename, allowing spaces in the name (bot-generated images are
    // often labelled "[IMAGE]a fluffy little cat.png"). Lazy + same-line + bounded
    // so it strips the whole marker without eating unrelated trailing prose.
    .replace(/\[(?:IMAGE|FILE|RECORD|VIDEO)\][^\r\n]{0,200}?\.(?:png|jpe?g|gif|webp|svg|pdf|txt|docx?|xlsx?|pptx?|zip|wav|mp3|mp4|webm)/gi, '')
    // Marker + bare token with no extension (attachment ids, hashes).
    .replace(/\[(?:IMAGE|FILE|RECORD|VIDEO)\][A-Za-z0-9._-]{8,150}/gi, '')
    // A marker left on its own (image segment carried the file out-of-band).
    .replace(/\[(?:IMAGE|FILE|RECORD|VIDEO)\]/gi, '')
    .replace(/\s*&&[A-Za-z0-9_-]+&&\s*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
  return options.trim === false ? cleaned : cleaned.trim();
}

/**
 * Extract user-facing content from AstrBot's send_message_to_user tool call.
 * Handles plain text, images, files, records, and videos — everything the bot
 * can emit autonomously (same capability as the QQ adapter).
 *
 * Returns '' when the frame isn't a send_message_to_user call or all messages
 * are empty, so the caller can fall through to other frame-type handlers.
 */
export function toolCallMarkdown(frame: Record<string, unknown>): string {
  if (frame.chain_type !== 'tool_call' || typeof frame.data !== 'string') return '';
  let call: Record<string, unknown>;
  try {
    call = JSON.parse(frame.data) as Record<string, unknown>;
  } catch {
    return '';
  }
  if (!call || typeof call !== 'object') return '';
  if (call.name !== 'send_message_to_user') return '';
  const args = call.args && typeof call.args === 'object'
    ? call.args as Record<string, unknown>
    : {};
  const messages = Array.isArray(args.messages) ? args.messages : [];
  const parts: string[] = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue;
    const m = msg as Record<string, unknown>;
    const type = String(m.type ?? '');
    // Plain text — the bot is "talking" autonomously (same as QQ text messages).
    if (type === 'plain' || type === 'text') {
      const t = typeof m.text === 'string' ? m.text.trim() : '';
      if (t) parts.push(t);
      continue;
    }
    // Attachment types (image, file, record, video) — render as markdown.
    if (ATTACH_SEGMENT_TYPES.has(type)) {
      const md = attachmentMarkdown(m);
      if (md) parts.push(md);
      continue;
    }
    // Unknown type with text fallback.
    const t = typeof m.text === 'string' ? m.text.trim() : '';
    if (t) parts.push(t);
  }
  return parts.join('\n\n');
}

export function parseSseReply(raw: string): string {
  let plain = '';
  let complete = '';
  const attach: string[] = [];
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data:')) continue;
    try {
      const json = JSON.parse(line.slice(5).trim()) as Record<string, unknown>;
      const toolMd = toolCallMarkdown(json);
      if (toolMd) {
        attach.push(toolMd);
        continue;
      }
      if (json.chain_type === 'tool_call' || json.chain_type === 'tool_call_result') {
        continue;
      }
      if (json.type === 'complete' && typeof json.data === 'string' && json.data) {
        complete = json.data;
      } else if (json.type === 'plain' && typeof json.data === 'string' && json.data && !complete) {
        plain += json.data;
      } else if (typeof json.type === 'string' && ATTACH_SEGMENT_TYPES.has(json.type)) {
        const md = attachmentMarkdown(json);
        if (md) attach.push(md);
      }
    } catch { /* skip malformed lines */ }
  }
  const text = cleanAstrBotText(complete || plain);
  return [attach.join(''), text].filter(Boolean).join(text && attach.length ? '\n\n' : '');
}
