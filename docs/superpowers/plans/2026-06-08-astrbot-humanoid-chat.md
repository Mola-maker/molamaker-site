# AstrBot Humanoid Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Debug the AstrBot chat system, add rich message-type rendering (tool progress cards, images, audio, video), humanise conversation pacing (typing delay, mood tinting), and add a full-screen catgirl animation overlay triggered by keyword detection.

**Architecture:** Extend `ChatMessage` with a `kind` discriminant so tool-progress frames and text replies render differently. Add a parallel `{ tool }` SSE frame type in the stream proxy so AstrBot tool calls are visible instead of silently dropped. Wire trigger-word detection in `useAstrbotChat` and render a full-screen CSS-keyframe overlay on matches. Refactor `astrbot-chat.tsx` to use `useAstrbotChat` + a new shared `<ChatPanel>` component (removing the 300-line duplicated inline implementation).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Vitest, CSS custom properties + keyframes (no animation library).

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `lib/chat/trigger-words.ts` | **create** | Trigger-word map + `detectTrigger(text)` |
| `lib/chat/mood.ts` | **create** | `detectMood(text)` → `'playful'\|'warm'\|'sharp'\|'neutral'` |
| `lib/chat/use-astrbot-chat.ts` | **modify** | Add `kind/toolName/toolStatus/toolSummary/mood` to `ChatMessage`; parse `{tool}` SSE frames; typing delay; `useTriggerAnimation` |
| `app/api/astrbot/chat/stream/route.ts` | **modify** | Emit `{tool:{name,status,summary}}` SSE frames for non-`send_message_to_user` tool calls; add `sendTool` helper |
| `app/api/astrbot/chat/route.ts` | **modify** | Inject persona prefix for attachment messages (parity fix) |
| `components/redesign/chat-panel.tsx` | **create** | Shared panel header + body + footer JSX consumed by both bubble and Live2D surfaces |
| `components/redesign/message-renderer.tsx` | **create** | Renders one `ChatMessage` bubble: text (ReactMarkdown), tool-progress card, image/file/audio/video chips |
| `components/redesign/trigger-animation-overlay.tsx` | **create** | Full-screen portal overlay, CSS-keyframe catgirl animations, auto-dismisses after 2.5 s |
| `components/redesign/astrbot-chat.tsx` | **modify** | Replace 300-line inline impl with `useAstrbotChat` + `<ChatPanel>` |
| `components/redesign/live2d-chat.tsx` | **modify** | Replace inline panel JSX with `<ChatPanel>` |
| `app/redesign-styles/09-astrbot.css` | **modify** | Add mood tints, tool-card styles, animation keyframes |
| `test/chat/trigger-words.test.ts` | **create** | Vitest unit tests for `detectTrigger` |
| `test/chat/mood.test.ts` | **create** | Vitest unit tests for `detectMood` |

---

## Task 1: Trigger-word detector (TDD)

**Files:**
- Create: `lib/chat/trigger-words.ts`
- Create: `test/chat/trigger-words.test.ts`

- [ ] **Step 1.1 — Write failing test**

```ts
// test/chat/trigger-words.test.ts
import { describe, it, expect } from 'vitest'
import { detectTrigger } from '@/lib/chat/trigger-words'

describe('detectTrigger', () => {
  it('detects haha → laugh', () => expect(detectTrigger('haha that was funny')).toBe('laugh'))
  it('detects 哈哈 → laugh', () => expect(detectTrigger('哈哈这个好笑')).toBe('laugh'))
  it('detects ni hao → konnichiwa', () => expect(detectTrigger('ni hao!')).toBe('konnichiwa'))
  it('detects nihao → konnichiwa', () => expect(detectTrigger('nihao minna')).toBe('konnichiwa'))
  it('detects hentai → blush', () => expect(detectTrigger('you are such a hentai')).toBe('blush'))
  it('detects kawaii → sparkle', () => expect(detectTrigger('that is so kawaii')).toBe('sparkle'))
  it('detects love → heart', () => expect(detectTrigger('love you')).toBe('heart'))
  it('prefers blush(5) over laugh(1) on tie', () => expect(detectTrigger('haha hentai')).toBe('blush'))
  it('does not match "hi" inside "this"', () => expect(detectTrigger('this is a test')).toBeNull())
  it('returns null for plain text', () => expect(detectTrigger('what is the answer?')).toBeNull())
})
```

- [ ] **Step 1.2 — Run test (expect fail)**

```bash
npx vitest run test/chat/trigger-words.test.ts
```
Expected: `Cannot find module '@/lib/chat/trigger-words'`

- [ ] **Step 1.3 — Implement**

```ts
// lib/chat/trigger-words.ts
export type AnimationType = 'wave' | 'laugh' | 'blush' | 'sparkle' | 'heart' | 'konnichiwa'

export const TRIGGER_MAP: Record<string, AnimationType> = {
  'nihao': 'konnichiwa', 'ni hao': 'konnichiwa',
  'konnichiwa': 'konnichiwa', 'konichiwa': 'konnichiwa',
  'hello': 'wave', 'hey': 'wave', 'hi': 'wave',
  'haha': 'laugh', 'hehe': 'laugh', 'lol': 'laugh', 'xd': 'laugh', '哈哈': 'laugh',
  'hentai': 'blush', '变态': 'blush', 'baka': 'blush', '色色': 'blush',
  'kawaii': 'sparkle', '可爱': 'sparkle', 'cute': 'sparkle',
  'love': 'heart', 'suki': 'heart', '喜欢': 'heart', '爱你': 'heart',
}

const PRIORITY: Record<AnimationType, number> = {
  blush: 5, heart: 4, konnichiwa: 3, sparkle: 2, laugh: 1, wave: 0,
}

function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

export function detectTrigger(text: string): AnimationType | null {
  const norm = text.toLowerCase().replace(/[^\w\s一-鿿]/g, ' ')
  let best: AnimationType | null = null
  let bestP = -1
  for (const [trigger, anim] of Object.entries(TRIGGER_MAP)) {
    const isCjk = /[一-鿿]/.test(trigger)
    const hasSpace = trigger.includes(' ')
    const matched = isCjk
      ? norm.includes(trigger)
      : hasSpace
        ? norm.includes(trigger)
        : new RegExp(`\\b${esc(trigger)}\\b`).test(norm)
    if (matched && PRIORITY[anim] > bestP) { best = anim; bestP = PRIORITY[anim] }
  }
  return best
}
```

- [ ] **Step 1.4 — Run test (expect pass)**

```bash
npx vitest run test/chat/trigger-words.test.ts
```
Expected: all 10 tests PASS

- [ ] **Step 1.5 — Commit**

```bash
git add lib/chat/trigger-words.ts test/chat/trigger-words.test.ts
git commit -m "feat(chat): add trigger-word detector with priority map"
```

---

## Task 2: Mood detector (TDD)

**Files:**
- Create: `lib/chat/mood.ts`
- Create: `test/chat/mood.test.ts`

- [ ] **Step 2.1 — Write failing test**

```ts
// test/chat/mood.test.ts
import { describe, it, expect } from 'vitest'
import { detectMood } from '@/lib/chat/mood'

describe('detectMood', () => {
  it('detects playful from nep', () => expect(detectMood('Nep nep! Let me help!')).toBe('playful'))
  it('detects playful from lol', () => expect(detectMood('lol that is funny')).toBe('playful'))
  it('detects warm from thank', () => expect(detectMood('Thank you for asking!')).toBe('warm'))
  it('detects warm from glad', () => expect(detectMood("I'm glad I could help")).toBe('warm'))
  it('detects sharp from hmph', () => expect(detectMood('Hmph. State your business.')).toBe('sharp'))
  it('falls back to neutral', () => expect(detectMood('The answer is 42.')).toBe('neutral'))
  it('only checks first 80 chars', () => {
    const long = 'x'.repeat(80) + ' lol'
    expect(detectMood(long)).toBe('neutral')
  })
})
```

- [ ] **Step 2.2 — Run test (expect fail)**

```bash
npx vitest run test/chat/mood.test.ts
```

- [ ] **Step 2.3 — Implement**

```ts
// lib/chat/mood.ts
export type Mood = 'playful' | 'warm' | 'sharp' | 'neutral'

export function detectMood(text: string): Mood {
  const t = text.toLowerCase().slice(0, 80)
  if (/nep|haha|hehe|～|♪|lol|heehee|xd|yay|whee|wow/.test(t)) return 'playful'
  if (/thank|welcome|help|sure|happy|glad|谢|嗯|great|good to hear/.test(t)) return 'warm'
  if (/hmph|whatever|don't|won't|tsk|ugh|boring|annoying/.test(t)) return 'sharp'
  return 'neutral'
}
```

- [ ] **Step 2.4 — Run test (expect pass)**

```bash
npx vitest run test/chat/mood.test.ts
```

- [ ] **Step 2.5 — Commit**

```bash
git add lib/chat/mood.ts test/chat/mood.test.ts
git commit -m "feat(chat): add mood detector for bubble tinting"
```

---

## Task 3: Extend `ChatMessage` type + `useAstrbotChat` hook

**Files:**
- Modify: `lib/chat/use-astrbot-chat.ts`

- [ ] **Step 3.1 — Extend `ChatMessage` interface**

In `lib/chat/use-astrbot-chat.ts`, change the `ChatMessage` interface (line 13) to:

```ts
export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  ts: number;
  image?: string;
  // Rich message kinds
  kind?: 'text' | 'tool';
  toolName?: string;
  toolStatus?: 'running' | 'done' | 'error';
  toolSummary?: string;
  // Humanoid pacing
  mood?: 'playful' | 'warm' | 'sharp' | 'neutral';
}
```

- [ ] **Step 3.2 — Add imports for mood + trigger detection**

At the top of `lib/chat/use-astrbot-chat.ts`, add after the existing imports:

```ts
import { detectMood } from '@/lib/chat/mood';
import { detectTrigger, type AnimationType } from '@/lib/chat/trigger-words';
```

- [ ] **Step 3.3 — Add typing-delay + tool-frame support to `send` in `useAstrbotChat`**

Inside `useAstrbotChat`, replace the section beginning `const botId = uid();` down through `const pushToken = (tok: string) => {` with:

```ts
    const botId = uid();
    let acc = '';
    let started = false;
    const TYPING_DELAY_MS = 300;
    let pendingStart: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      if (signal.aborted || started) return;
      started = true;
      setMessages((m) => [...m, {
        id: botId, role: 'bot', text: acc, ts: Date.now(),
        mood: detectMood(acc),
      }]);
    };

    const pushToken = (tok: string) => {
      if (signal.aborted) return;
      acc += tok;
      if (!started) {
        if (pendingStart === null) pendingStart = setTimeout(flush, TYPING_DELAY_MS);
        return; // accumulate while typing delay is pending
      }
      setMessages((m) => m.map((x) =>
        x.id === botId ? { ...x, text: acc, mood: detectMood(acc) } : x
      ));
    };

    const pushToolFrame = (frame: { name: string; status: 'running' | 'done' | 'error'; summary?: string }) => {
      if (signal.aborted) return;
      const toolId = `tool-${botId}-${frame.name}`;
      setMessages((m) => {
        const existing = m.find((x) => x.id === toolId);
        if (existing) {
          return m.map((x) => x.id === toolId
            ? { ...x, toolStatus: frame.status, toolSummary: frame.summary }
            : x
          );
        }
        return [...m, {
          id: toolId, role: 'bot' as const, text: '', ts: Date.now(),
          kind: 'tool' as const,
          toolName: frame.name,
          toolStatus: frame.status,
          toolSummary: frame.summary,
        }];
      });
    };
```

- [ ] **Step 3.4 — Parse `{ tool }` SSE frames in the SSE reader loop**

Inside `useAstrbotChat`, in the SSE reading loop where `{ token }` is parsed (around `const { token } = JSON.parse(raw)`), replace with:

```ts
          try {
            const j = JSON.parse(raw) as { token?: string; tool?: { name: string; status: 'running' | 'done' | 'error'; summary?: string } };
            if (j.token) pushToken(j.token);
            else if (j.tool) pushToolFrame(j.tool);
          } catch { /* skip malformed frame */ }
```

- [ ] **Step 3.5 — Finalise mood on stream end**

After the SSE loop ends (where `if (!started && !signal.aborted)` is checked), also set the mood on the final accumulated text:

```ts
      if (!started && !signal.aborted) {
        if (pendingStart) clearTimeout(pendingStart);
        setMessages((m) => [...m, { id: uid(), role: 'bot', text: 'AI is temporarily unavailable — try again in a moment.', ts: Date.now() }]);
      } else if (started && acc) {
        // Finalise mood on the completed reply
        setMessages((m) => m.map((x) => x.id === botId ? { ...x, mood: detectMood(acc) } : x));
      }
```

- [ ] **Step 3.6 — Add `useTriggerAnimation` hook + return it**

At the end of `useAstrbotChat`, before the `return` statement, add:

```ts
  // ── Trigger animation ───────────────────────────────────────────
  const [activeAnimation, setActiveAnimation] = useState<AnimationType | null>(null);
  const lastTriggerMsgId = useRef<string | null>(null);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.id === lastTriggerMsgId.current) return;
    const anim = detectTrigger(last.text);
    if (anim) {
      lastTriggerMsgId.current = last.id;
      setActiveAnimation(anim);
    }
  }, [messages]);

  const dismissAnimation = useCallback(() => setActiveAnimation(null), []);
```

And add `activeAnimation, dismissAnimation` to the return object.

- [ ] **Step 3.7 — Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: zero errors. Fix any type errors before continuing.

- [ ] **Step 3.8 — Commit**

```bash
git add lib/chat/use-astrbot-chat.ts
git commit -m "feat(chat): extend ChatMessage with tool/mood; add typing delay + trigger animation"
```

---

## Task 4: Stream route — emit tool progress frames

**Files:**
- Modify: `app/api/astrbot/chat/stream/route.ts`

- [ ] **Step 4.1 — Add `ToolProgressFrame` type + `sendTool` to `makeSseStream`**

At the top of `app/api/astrbot/chat/stream/route.ts`, after the `type Send = ...` line, add:

```ts
type ToolProgressFrame = { name: string; status: 'running' | 'done' | 'error'; summary?: string };
type SendTool = (frame: ToolProgressFrame) => void;
```

Change `makeSseStream` signature and body:

```ts
function makeSseStream(gen: (send: Send, sendTool: SendTool) => Promise<void>): Response {
  const enc = new TextEncoder();
  const HEARTBEAT_MS = 25_000;
  const stream = new ReadableStream({
    async start(controller) {
      const send: Send = (token) => {
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify({ token })}\n\n`)); }
        catch { /* client disconnected */ }
      };
      const sendTool: SendTool = (frame) => {
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify({ tool: frame })}\n\n`)); }
        catch { /* client disconnected */ }
      };
      const hb = setInterval(() => {
        try { controller.enqueue(enc.encode(': heartbeat\n\n')); }
        catch { clearInterval(hb); }
      }, HEARTBEAT_MS);
      try {
        await gen(send, sendTool);
      } finally {
        clearInterval(hb);
        try {
          controller.enqueue(enc.encode('data: [DONE]\n\n'));
          controller.close();
        } catch { /* already closed */ }
      }
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

- [ ] **Step 4.2 — Update `streamAstrBot` signature to accept `sendTool`**

Change `streamAstrBot` signature from:

```ts
async function streamAstrBot(
  message: string,
  sessionId: string | undefined,
  username: string,
  send: Send,
  persona?: string,
): Promise<void> {
```

To:

```ts
async function streamAstrBot(
  message: string,
  sessionId: string | undefined,
  username: string,
  send: Send,
  sendTool: SendTool,
  persona?: string,
): Promise<void> {
```

- [ ] **Step 4.3 — Emit tool frames instead of silently dropping**

Inside `streamAstrBot`, in the frame-type handling section, replace:

```ts
      const toolMd = toolCallMarkdown(j);
      if (toolMd) {
        send(toolMd);
      } else if (j.chain_type === 'tool_call' || j.chain_type === 'tool_call_result') {
        // Tool JSON is transport metadata; render only the user-facing result.
      } else if (...)
```

With:

```ts
      const toolMd = toolCallMarkdown(j);
      if (toolMd) {
        send(toolMd);
      } else if (j.chain_type === 'tool_call' && typeof j.data === 'string') {
        try {
          const call = JSON.parse(j.data) as { name?: string };
          const name = String(call.name ?? 'tool');
          if (name !== 'send_message_to_user') {
            sendTool({ name, status: 'running', summary: `Running ${name}…` });
          }
        } catch { /* malformed */ }
      } else if (j.chain_type === 'tool_call_result' && typeof j.data === 'string') {
        try {
          const res = JSON.parse(j.data) as { name?: string; content?: string; result?: string };
          const name = String(res.name ?? 'tool');
          if (name !== 'send_message_to_user') {
            const raw = typeof res.content === 'string' ? res.content : typeof res.result === 'string' ? res.result : '';
            const summary = raw.slice(0, 100).replace(/\n/g, ' ') || 'done';
            sendTool({ name, status: 'done', summary });
          }
        } catch { /* malformed */ }
      } else if (...)
```

- [ ] **Step 4.4 — Update `streamCoze` and `streamDeepSeek` signatures**

These providers don't emit tool calls, so add `_sendTool: SendTool` as a no-op parameter:

```ts
async function streamCoze(
  message: string,
  userId: string,
  send: Send,
  _sendTool: SendTool,
  cfg: EffectiveProvider,
  persona?: string,
): Promise<void> { /* existing body unchanged */ }

async function streamDeepSeek(
  message: string,
  send: Send,
  _sendTool: SendTool,
  cfg: EffectiveProvider,
  persona?: string,
): Promise<void> { /* existing body unchanged */ }
```

- [ ] **Step 4.5 — Update POST handler call sites**

In the `makeSseStream(async (send) => {` callback, change to `async (send, sendTool) => {` and pass `sendTool` to each runner:

```ts
  return makeSseStream(async (send, sendTool) => {
    let emitted = false;
    const wrap: Send = (t) => { emitted = true; send(t); };
    const wrapTool: SendTool = (f) => sendTool(f);

    const runners: Array<() => Promise<void>> = [];
    if (getAstrbotEnv().configured)
      runners.push(() => streamAstrBot(message, sessionId, username, wrap, wrapTool, persona));
    if (!astrbotOnly) {
      if (cozeCfg.configured)
        runners.push(() => streamCoze(message, sessionId ?? username, wrap, () => {}, cozeCfg, persona));
      if (deepseekCfg.configured)
        runners.push(() => streamDeepSeek(message, wrap, () => {}, deepseekCfg, persona));
    }
    if (runners.length === 0) { send('AstrBot is not connected yet — start the AstrBot service to chat here.'); return; }

    for (const run of runners) {
      try { await run(); if (emitted) return; } catch { if (emitted) return; }
    }
    if (!emitted) send('AI is temporarily unavailable — try again in a moment.');
  });
```

- [ ] **Step 4.6 — Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: zero errors.

- [ ] **Step 4.7 — Commit**

```bash
git add app/api/astrbot/chat/stream/route.ts
git commit -m "feat(api): emit tool progress SSE frames from AstrBot stream proxy"
```

---

## Task 5: Fix persona in non-stream attachment route

**Files:**
- Modify: `app/api/astrbot/chat/route.ts`

- [ ] **Step 5.1 — Read persona from request body**

In `POST`, after `const username = ...` line, add:

```ts
  const persona = String(body.persona ?? '').trim().slice(0, 800) || undefined;
```

- [ ] **Step 5.2 — Inject persona prefix in `tryAstrBot` call for attachment messages**

Change the `tryAstrBot` call for the attachment branch:

```ts
  if (attachments.length > 0) {
    const chain: Array<Record<string, unknown>> = [];
    if (persona) chain.push({ type: 'plain', text: `[Roleplay as: ${persona}]` });
    if (text) chain.push({ type: 'plain', text });
    for (const a of attachments) chain.push({ type: a.type, attachment_id: a.attachment_id });
    const result = await tryAstrBot(chain, sessionId, username);
```

- [ ] **Step 5.3 — Type-check + commit**

```bash
npx tsc --noEmit 2>&1 | head -10
git add app/api/astrbot/chat/route.ts
git commit -m "fix(api): inject persona prefix for attachment messages in non-stream route"
```

---

## Task 6: CSS — mood tints, tool cards, animation keyframes

**Files:**
- Modify: `app/redesign-styles/09-astrbot.css`

- [ ] **Step 6.1 — Add mood tints, tool card styles, and animation CSS**

Append to `app/redesign-styles/09-astrbot.css`:

```css
/* ── Mood tinting ─────────────────────────────────────────────── */
.ab-msg--bot[data-mood="playful"] .ab-msg__bubble { border-left: 3px solid oklch(78% 0.18 145); }
.ab-msg--bot[data-mood="warm"]    .ab-msg__bubble { border-left: 3px solid oklch(78% 0.18 55); }
.ab-msg--bot[data-mood="sharp"]   .ab-msg__bubble { border-left: 3px solid oklch(72% 0.14 0); }

/* ── Tool progress card ───────────────────────────────────────── */
.ab-tool-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 10px;
  border: 1px dashed var(--rule);
  background: var(--bg);
  font-size: 11.5px;
  color: var(--ink-soft);
  font-family: var(--font-mono);
  max-width: 78%;
  animation: abMsgIn 300ms var(--ease-out-quart) both;
}
.ab-tool-card__icon { font-size: 13px; flex-shrink: 0; }
.ab-tool-card__name { font-weight: 600; color: var(--ink); }
.ab-tool-card__summary {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ab-tool-card--running .ab-tool-card__icon {
  animation: abToolSpin 1s linear infinite;
}
.ab-tool-card--done { opacity: 0.6; }
.ab-tool-card--error { border-color: oklch(72% 0.14 0); color: oklch(60% 0.14 0); }
@keyframes abToolSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* ── Full-screen trigger animation overlay ───────────────────── */
.ab-anim-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.ab-anim-overlay__bg {
  position: absolute;
  inset: 0;
  animation: abAnimFade 2.5s ease-out forwards;
}
.ab-anim-overlay__char {
  position: relative;
  font-size: clamp(80px, 20vw, 160px);
  line-height: 1;
  z-index: 1;
  user-select: none;
}
@keyframes abAnimFade {
  0%   { opacity: 0.85; }
  60%  { opacity: 0.85; }
  100% { opacity: 0; }
}

/* Wave */
.ab-anim--wave .ab-anim-overlay__bg { background: radial-gradient(circle, oklch(85% 0.14 200 / 0.5) 0%, transparent 70%); }
.ab-anim--wave .ab-anim-overlay__char { animation: abWave 2.5s ease-out forwards; }
@keyframes abWave {
  0%   { transform: translateX(-120%) scale(0.8); opacity: 0; }
  20%  { transform: translateX(0) scale(1.1); opacity: 1; }
  40%  { transform: translateX(0) rotate(-15deg) scale(1.05); }
  60%  { transform: translateX(0) rotate(15deg) scale(1.05); }
  80%  { transform: translateX(0) rotate(-8deg) scale(1); opacity: 1; }
  100% { transform: translateX(120%) scale(0.8); opacity: 0; }
}

/* Laugh */
.ab-anim--laugh .ab-anim-overlay__bg { background: radial-gradient(circle, oklch(85% 0.18 85 / 0.45) 0%, transparent 70%); }
.ab-anim--laugh .ab-anim-overlay__char { animation: abLaugh 2.5s ease-out forwards; }
@keyframes abLaugh {
  0%,100% { transform: scale(0); opacity: 0; }
  10%     { transform: scale(1.4); opacity: 1; }
  20%,40%,60% { transform: scale(1) rotate(-8deg); }
  30%,50%     { transform: scale(1.05) rotate(8deg); }
  85%     { transform: scale(1); opacity: 1; }
  100%    { transform: scale(0); opacity: 0; }
}

/* Blush */
.ab-anim--blush .ab-anim-overlay__bg { background: radial-gradient(circle, oklch(85% 0.2 0 / 0.4) 0%, transparent 60%); }
.ab-anim--blush .ab-anim-overlay__char { animation: abBlush 2.5s ease-out forwards; }
@keyframes abBlush {
  0%   { transform: scale(0) rotate(20deg); opacity: 0; }
  15%  { transform: scale(1.3) rotate(-5deg); opacity: 1; }
  30%  { transform: scale(1.1) rotate(0deg); }
  80%  { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(2); opacity: 0; }
}

/* Sparkle */
.ab-anim--sparkle .ab-anim-overlay__bg { background: radial-gradient(circle, oklch(92% 0.15 55 / 0.5) 0%, transparent 65%); }
.ab-anim--sparkle .ab-anim-overlay__char { animation: abSparkle 2.5s ease-out forwards; }
@keyframes abSparkle {
  0%,100% { transform: scale(0); opacity: 0; }
  10%     { transform: scale(1.5); opacity: 1; }
  20%,60% { transform: scale(1) rotate(-5deg); }
  40%,80% { transform: scale(1.1) rotate(5deg); }
  90%     { transform: scale(1); opacity: 0.8; }
}

/* Heart */
.ab-anim--heart .ab-anim-overlay__bg { background: radial-gradient(circle, oklch(85% 0.2 350 / 0.4) 0%, transparent 60%); }
.ab-anim--heart .ab-anim-overlay__char { animation: abHeart 2.5s ease-out forwards; }
@keyframes abHeart {
  0%   { transform: translateY(40vh) scale(0.5); opacity: 0; }
  15%  { transform: translateY(0) scale(1.3); opacity: 1; }
  40%  { transform: translateY(-10px) scale(1.2); }
  65%  { transform: translateY(5px) scale(1.05); opacity: 1; }
  100% { transform: translateY(-60vh) scale(0.5); opacity: 0; }
}

/* Konnichiwa */
.ab-anim--konnichiwa .ab-anim-overlay__bg { background: radial-gradient(circle, oklch(85% 0.16 165 / 0.45) 0%, transparent 65%); }
.ab-anim--konnichiwa .ab-anim-overlay__char { animation: abKonnichiwa 2.5s ease-out forwards; }
@keyframes abKonnichiwa {
  0%   { transform: translateY(-100%) scale(0.8); opacity: 0; }
  15%  { transform: translateY(0) scale(1.1); opacity: 1; }
  35%  { transform: translateY(0) rotate(-20deg) scale(0.9); }
  50%  { transform: translateY(0) rotate(0deg) scale(1); }
  75%  { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(-100%) scale(0.8); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .ab-anim-overlay__char { animation: abAnimFlash 0.5s ease-out forwards !important; }
  @keyframes abAnimFlash {
    0%,100% { opacity: 0; }
    50%     { opacity: 1; }
  }
}
```

- [ ] **Step 6.2 — Commit**

```bash
git add app/redesign-styles/09-astrbot.css
git commit -m "feat(css): mood tints, tool progress cards, catgirl animation keyframes"
```

---

## Task 7: `TriggerAnimationOverlay` component

**Files:**
- Create: `components/redesign/trigger-animation-overlay.tsx`

- [ ] **Step 7.1 — Create component**

```tsx
// components/redesign/trigger-animation-overlay.tsx
'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { AnimationType } from '@/lib/chat/trigger-words';

const ANIM_DURATION_MS = 2500;

const EMOJI: Record<AnimationType, string> = {
  wave:        '🐱✋',
  laugh:       '😹',
  blush:       '😳',
  sparkle:     '✨',
  heart:       '💕',
  konnichiwa:  '🐱🎌',
};

interface Props {
  animation: AnimationType | null;
  onDismiss: () => void;
}

export function TriggerAnimationOverlay({ animation, onDismiss }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!animation) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onDismiss, ANIM_DURATION_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [animation, onDismiss]);

  if (!animation || typeof document === 'undefined') return null;

  return createPortal(
    <div className={`ab-anim-overlay ab-anim--${animation}`} aria-hidden="true">
      <div className="ab-anim-overlay__bg" />
      <span className="ab-anim-overlay__char">{EMOJI[animation]}</span>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 7.2 — Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7.3 — Commit**

```bash
git add components/redesign/trigger-animation-overlay.tsx
git commit -m "feat(chat): add TriggerAnimationOverlay catgirl animation component"
```

---

## Task 8: `MessageRenderer` component

**Files:**
- Create: `components/redesign/message-renderer.tsx`

- [ ] **Step 8.1 — Create component**

```tsx
// components/redesign/message-renderer.tsx
'use client';

import { useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toMarkdown } from '@/lib/chat/use-astrbot-chat';
import type { ChatMessage } from '@/lib/chat/use-astrbot-chat';

// ── Graceful image with error fallback ─────────────────────────
function MdImage({ src, alt }: { src?: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src) return null;
  if (failed) {
    return (
      <a className="ab-md__img-fail" href={src} target="_blank" rel="noopener noreferrer">
        🖼️ {alt?.trim() || 'image unavailable — tap to open'}
      </a>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="ab-msg__img" src={src} alt={alt ?? ''} loading="lazy" onError={() => setFailed(true)} />
  );
}

const MD_COMPONENTS: Components = {
  img: ({ src, alt }) => (
    <MdImage
      src={typeof src === 'string' ? src : undefined}
      alt={typeof alt === 'string' ? alt : undefined}
    />
  ),
};

// ── Tool status icons ───────────────────────────────────────────
const TOOL_ICON: Record<string, string> = {
  running: '⟳',
  done:    '✓',
  error:   '⚠',
};

// ── Tool progress card ──────────────────────────────────────────
function ToolCard({ msg }: { msg: ChatMessage }) {
  const status = msg.toolStatus ?? 'running';
  return (
    <div className={`ab-tool-card ab-tool-card--${status}`}>
      <span className="ab-tool-card__icon">{TOOL_ICON[status]}</span>
      <span className="ab-tool-card__name">{msg.toolName ?? 'tool'}</span>
      {msg.toolSummary && (
        <span className="ab-tool-card__summary">{msg.toolSummary}</span>
      )}
    </div>
  );
}

// ── Main renderer ───────────────────────────────────────────────
interface Props {
  msg: ChatMessage;
}

export function MessageRenderer({ msg }: Props) {
  if (msg.kind === 'tool') {
    return <ToolCard msg={msg} />;
  }

  // User messages: plain text
  if (msg.role === 'user') {
    return (
      <>
        {msg.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="ab-msg__img" src={msg.image} alt="" />
        )}
        {msg.text && <span className="ab-msg__usertext">{msg.text}</span>}
      </>
    );
  }

  // Bot messages: Markdown
  return (
    <div className="ab-md">
      {msg.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ab-msg__img" src={msg.image} alt="" />
      )}
      {msg.text && (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
          {toMarkdown(msg.text)}
        </ReactMarkdown>
      )}
    </div>
  );
}
```

- [ ] **Step 8.2 — Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 8.3 — Commit**

```bash
git add components/redesign/message-renderer.tsx
git commit -m "feat(chat): add MessageRenderer with tool cards and Markdown for all surfaces"
```

---

## Task 9: Shared `<ChatPanel>` component

**Files:**
- Create: `components/redesign/chat-panel.tsx`

- [ ] **Step 9.1 — Create component**

```tsx
// components/redesign/chat-panel.tsx
'use client';

import type { CSSProperties, RefObject } from 'react';
import type { ChatMessage, ChatAttachment } from '@/lib/chat/use-astrbot-chat';
import type { AnimationType } from '@/lib/chat/trigger-words';
import { MessageRenderer } from './message-renderer';
import { TriggerAnimationOverlay } from './trigger-animation-overlay';

interface ChatPanelProps {
  // Content
  messages: ChatMessage[];
  loading: boolean;
  input: string;
  attachment: ChatAttachment | null;
  uploading: boolean;
  configured: boolean | null;
  // Header
  avatarContent: React.ReactNode;        // <img> or <span> initial
  name: string;
  extraClass?: string;                   // e.g. "ab-panel--live2d"
  // Refs
  bodyRef: RefObject<HTMLDivElement | null>;
  fileRef: RefObject<HTMLInputElement | null>;
  // Position
  style?: CSSProperties;
  // Handlers
  onMouseDown: (e: React.MouseEvent) => void;
  onReset: () => void;
  onClose: () => void;
  onAttachClick: () => void;
  onPickFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearAttachment: () => void;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  // Animation
  activeAnimation: AnimationType | null;
  onDismissAnimation: () => void;
}

export function ChatPanel({
  messages, loading, input, attachment, uploading, configured,
  avatarContent, name, extraClass, bodyRef, fileRef,
  style, onMouseDown, onReset, onClose, onAttachClick,
  onPickFile, onClearAttachment, onInputChange, onKeyDown, onSend,
  activeAnimation, onDismissAnimation,
}: ChatPanelProps) {
  return (
    <div className={`ab-panel${extraClass ? ` ${extraClass}` : ''}`} style={style}>
      {/* Header */}
      <div className="ab-panel__header" onMouseDown={onMouseDown}>
        <div className="ab-panel__avatar">{avatarContent}</div>
        <div className="ab-panel__title">
          <span className="ab-panel__name">{name}</span>
          <span className="ab-panel__status">
            <span className="ab-status-dot" />
            {configured ? 'online' : 'connecting…'}
          </span>
        </div>
        <button className="ab-panel__reset" onClick={onReset} onMouseDown={(e) => e.stopPropagation()} aria-label="Reset chat" title="Reset chat">↺</button>
        <button className="ab-panel__close" onClick={onClose} onMouseDown={(e) => e.stopPropagation()} aria-label="Close">×</button>
      </div>

      {/* Messages */}
      <div className="ab-panel__body" ref={bodyRef}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`ab-msg ab-msg--${msg.role}`}
            {...(msg.mood ? { 'data-mood': msg.mood } : {})}
          >
            {msg.role === 'bot' && msg.kind !== 'tool' && (
              <span className="ab-msg__avatar" aria-hidden="true">✦</span>
            )}
            <div className="ab-msg__bubble">
              <MessageRenderer msg={msg} />
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role !== 'bot' && (
          <div className="ab-msg ab-msg--bot">
            <span className="ab-msg__avatar" aria-hidden="true">✦</span>
            <div className="ab-msg__bubble ab-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="ab-panel__footer">
        {attachment && (
          <div className="ab-attach">
            {attachment.type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="ab-attach__thumb" src={attachment.previewUrl} alt="" />
            ) : (
              <span className="ab-attach__file" aria-hidden="true">📄</span>
            )}
            <span className="ab-attach__name">{attachment.file.name}</span>
            <button className="ab-attach__remove" onClick={onClearAttachment} onMouseDown={(e) => e.stopPropagation()} aria-label="Remove attachment">×</button>
          </div>
        )}
        <div className="ab-panel__input-row">
          <button className="ab-panel__attach" onClick={onAttachClick} disabled={loading || uploading} aria-label="Attach" title="Attach a photo or file">📎</button>
          <input ref={fileRef} type="file" accept="image/*,application/pdf,text/plain" hidden onChange={onPickFile} />
          <textarea
            className="ab-panel__input"
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            placeholder="Ask anything… (Enter to send)"
            rows={1}
            disabled={loading}
          />
          <button className="ab-panel__send" onClick={onSend} disabled={loading || uploading || (!input.trim() && !attachment)} aria-label="Send">
            {uploading ? '…' : '↑'}
          </button>
        </div>
      </div>

      <TriggerAnimationOverlay animation={activeAnimation} onDismiss={onDismissAnimation} />
    </div>
  );
}
```

- [ ] **Step 9.2 — Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 9.3 — Commit**

```bash
git add components/redesign/chat-panel.tsx
git commit -m "feat(chat): add shared ChatPanel component consumed by bubble + Live2D surfaces"
```

---

## Task 10: Refactor `astrbot-chat.tsx` to use hook + `ChatPanel`

**Files:**
- Modify: `components/redesign/astrbot-chat.tsx`

- [ ] **Step 10.1 — Replace file content**

Replace the entire file with:

```tsx
// components/redesign/astrbot-chat.tsx
'use client';

import { createPortal } from 'react-dom';
import { assetUrl } from '@/lib/asset-url';
import { useAstrbotChat, INITIAL_MESSAGE } from '@/lib/chat/use-astrbot-chat';
import { ChatPanel } from './chat-panel';

export function AstrbotChat() {
  const chat = useAstrbotChat();

  if (chat.configured === false) return null;

  const bubbleStyle: React.CSSProperties = {
    transform: `translate(${chat.pos.x}px, ${chat.pos.y}px)`,
  };

  const avatarContent = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={assetUrl('/redesign/miku-dance.gif')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  );

  return (
    <>
      <div className="ab-widget" style={bubbleStyle} ref={chat.bubbleRef}>
        {!chat.open && (
          <button
            className="ab-bubble"
            onClick={() => chat.setOpen(true)}
            onMouseDown={chat.onMouseDown}
            aria-label="Open AstrBot chat"
            title="Chat with AstrBot"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetUrl('/redesign/miku-dance.gif')} alt="Miku" className="ab-bubble__gif" />
            <span className="ab-bubble__badge" aria-hidden="true">✦</span>
          </button>
        )}
      </div>

      {chat.open && createPortal(
        <ChatPanel
          messages={chat.messages}
          loading={chat.loading}
          input={chat.input}
          attachment={chat.attachment}
          uploading={chat.uploading}
          configured={chat.configured}
          avatarContent={avatarContent}
          name="AstrBot × Miku"
          style={chat.panelStyle('bottom-right')}
          bodyRef={chat.bodyRef}
          fileRef={chat.fileRef}
          onMouseDown={chat.onMouseDown}
          onReset={() => { chat.setMessages([INITIAL_MESSAGE]); chat.setInput(''); }}
          onClose={() => chat.setOpen(false)}
          onAttachClick={() => chat.fileRef.current?.click()}
          onPickFile={chat.onPickFile}
          onClearAttachment={chat.clearAttachment}
          onInputChange={(e) => chat.setInput(e.target.value)}
          onKeyDown={chat.onKeyDown}
          onSend={chat.send}
          activeAnimation={chat.activeAnimation}
          onDismissAnimation={chat.dismissAnimation}
        />,
        document.body,
      )}
    </>
  );
}
```

- [ ] **Step 10.2 — Export `dismissAnimation` from hook return**

Ensure `lib/chat/use-astrbot-chat.ts` return object includes `activeAnimation` and `dismissAnimation` (added in Task 3.6). Verify with:

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 10.3 — Commit**

```bash
git add components/redesign/astrbot-chat.tsx
git commit -m "refactor(chat): replace 300-line inline AstrbotChat with useAstrbotChat + ChatPanel"
```

---

## Task 11: Update `live2d-chat.tsx` to use `ChatPanel`

**Files:**
- Modify: `components/redesign/live2d-chat.tsx`

- [ ] **Step 11.1 — Replace panel JSX with `<ChatPanel>`**

In `components/redesign/live2d-chat.tsx`, remove the entire `return chat.open ? createPortal(...)` block and replace with:

```tsx
  const initial = persona.name.trim().charAt(0).toUpperCase();
  const avatarContent = (
    <div className="ab-panel__avatar--mono" style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(2px)' }}>
      <span style={{ fontFamily: 'var(--font-display, var(--font-mono))', fontSize: '17px', fontWeight: 600, color: '#fff', lineHeight: 1 }}>{initial}</span>
    </div>
  );

  const panelStyle = { ...chat.panelStyle('bottom-left'), '--ab-accent': persona.accent } as React.CSSProperties;

  return chat.open ? createPortal(
    <ChatPanel
      messages={chat.messages}
      loading={chat.loading}
      input={chat.input}
      attachment={chat.attachment}
      uploading={chat.uploading}
      configured={chat.configured}
      avatarContent={avatarContent}
      name={persona.name}
      extraClass="ab-panel--live2d"
      style={panelStyle}
      bodyRef={bodyRef}
      fileRef={chat.fileRef}
      onMouseDown={chat.onMouseDown}
      onReset={() => { chat.setMessages([{ id: `persona-${persona.id}`, role: 'bot', text: persona.greeting, ts: 0 }]); chat.setInput(''); }}
      onClose={() => chat.setOpen(false)}
      onAttachClick={() => chat.fileRef.current?.click()}
      onPickFile={chat.onPickFile}
      onClearAttachment={chat.clearAttachment}
      onInputChange={(e) => chat.setInput(e.target.value)}
      onKeyDown={chat.onKeyDown}
      onSend={chat.send}
      activeAnimation={chat.activeAnimation}
      onDismissAnimation={chat.dismissAnimation}
    />,
    document.body,
  ) : null;
```

Also remove the `BotMarkdown` and `MdImage` local definitions (now in `MessageRenderer`) and the `ReactMarkdown`/`remarkGfm` imports. Add import:

```ts
import { ChatPanel } from './chat-panel';
```

Remove the import of `toMarkdown` if it's no longer used directly (it's used inside `MessageRenderer` now).

- [ ] **Step 11.2 — Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 11.3 — Commit**

```bash
git add components/redesign/live2d-chat.tsx
git commit -m "refactor(chat): Live2DChat uses shared ChatPanel, remove duplicated Markdown renderer"
```

---

## Task 12: Final verification

- [ ] **Step 12.1 — Run all tests**

```bash
npx vitest run
```
Expected: all tests PASS (including the 17 new tests from Tasks 1 and 2).

- [ ] **Step 12.2 — TypeScript clean**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 12.3 — Lint**

```bash
npm run lint
```
Expected: 0 warnings.

- [ ] **Step 12.4 — Build**

```bash
npm run build 2>&1 | tail -20
```
Expected: clean build, no errors.

- [ ] **Step 12.5 — Manual smoke test checklist**

Start the dev server (`npm run dev`) and verify:
1. Open any page with the chat bubble — bubble appears, click opens panel
2. Type "haha" and send — laugh animation plays for ~2.5 s
3. Type "hentai" — blush animation plays
4. Type "nihao" — konnichiwa animation plays
5. With AstrBot connected and a tool-calling pipeline: send a web-search query — tool progress card shows `⟳ web_search — Running...` while waiting, then collapses to `✓ web_search — Found...`
6. Bot reply with "Nep nep!" should have a green left-border tint (playful mood)
7. Open Live2D chat (workplace variant) — same animations work there too
8. File attachment send works (non-stream route)

- [ ] **Step 12.6 — Final commit**

```bash
git add .
git commit -m "feat(chat): humanoid AstrBot chat — rich types, tool cards, mood tints, catgirl animations"
```

---

## Self-Review

**Spec coverage check:**
- ✅ §1.1 `astrbot-chat.tsx` refactor → Tasks 10
- ✅ §1.2 Tool-call frames silently dropped → Task 4 (stream route)
- ✅ §1.3 Flat ChatMessage type → Task 3 (ChatMessage extended)
- ✅ §1.4 Persona prefix parity → Task 5
- ✅ §2 Segment model → simplified to `kind` discriminant on ChatMessage (Tasks 3, 8)
- ✅ §2.2 Tool progress SSE → Task 4
- ✅ §2.3 `astrbot-chat.tsx` refactor → Task 10
- ✅ §2.4 Shared ChatPanel → Task 9
- ✅ §2.5 MessageRenderer → Task 8
- ✅ §2.6a Typing delay → Task 3.3
- ✅ §2.6b Tool progress cards → Tasks 4 + 8
- ✅ §2.6c Mood tinting → Tasks 2, 3, 6
- ✅ §3.1 TriggerAnimationOverlay → Task 7
- ✅ §3.2 Trigger detection → Task 1
- ✅ §3.3 Animation CSS variants (wave/laugh/blush/sparkle/heart/konnichiwa) → Task 6
- ✅ §3.4 `useTriggerAnimation` in hook → Task 3.6
- ✅ §4 Component tree wired → Tasks 9, 10, 11
- ✅ §8 Success criteria → Task 12 smoke test covers all 7 items

**Type consistency check:**
- `AnimationType` defined in `trigger-words.ts`, used in `use-astrbot-chat.ts`, `trigger-animation-overlay.tsx`, `chat-panel.tsx` — consistent
- `ChatMessage.kind`, `toolName`, `toolStatus`, `toolSummary` defined in Task 3, used in Tasks 8, 9 — consistent
- `ToolProgressFrame` defined in stream route Task 4, consumed by hook in Task 3 — consistent shapes `{ name, status, summary }`
- `SendTool` type defined in Task 4.1, referenced in Task 4.2–4.5 — consistent
- `ChatPanel` props: `bodyRef: RefObject<HTMLDivElement | null>` — matches hook's `bodyRef: useRef<HTMLDivElement>(null)` type — consistent
