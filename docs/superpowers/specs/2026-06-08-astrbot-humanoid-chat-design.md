# AstrBot — Humanoid Chat, Rich Message Types & Animation Hooks

**Date:** 2026-06-08  
**Branch:** fix/prod-deploy-failures → feature/astrbot-humanoid-chat  
**Scope:** Debug + enrich the AstrBot chat system: unify component/hook, display every message type & tool call, humanise conversation pacing, add full-screen trigger-word catgirl animations.

---

## 1. Current State & Known Bugs

### 1.1 Duplicated logic (`astrbot-chat.tsx`)
`astrbot-chat.tsx` still implements **all chat state inline** — it predates the extraction of `useAstrbotChat`. The unfinished plan (`live2d-astrbot-chat-integration`) marked this refactor `in_progress`. Result: two divergent codepaths that drift apart over time. The Live2D panel has full Markdown rendering; the bubble panel uses a bare regex renderer.

### 1.2 Tool-call frames silently dropped
`streamAstrBot` in `chat/stream/route.ts` handles `send_message_to_user` tool calls but **silently drops all others** (`chain_type: tool_call`, `chain_type: tool_call_result` for every other tool: web-search, code-runner, file-ops, etc.). Users see a blank stream while AstrBot executes tools.

### 1.3 Flat `ChatMessage` type — no segment model
`ChatMessage` carries a single `text: string` field. Rich AstrBot output (images, audio, files, tool progress) are all stringified into that one field. Structured rendering (image cards, file chips, audio players) is impossible without a segment model.

### 1.4 Persona prefix leaks in non-stream path
The non-streaming `POST /api/astrbot/chat` route does **not** inject the persona prefix. Only the stream route does. Live2D chat works, but the bubble panel (which uses the non-stream route for attachments) ignores persona.

---

## 2. Architecture

### 2.1 Segment model (new)

```ts
// lib/chat/message-segments.ts
export type TextSegment    = { kind: 'text';      content: string }
export type ImageSegment   = { kind: 'image';     url: string; label: string }
export type FileSegment    = { kind: 'file';      url: string; label: string; mime?: string }
export type AudioSegment   = { kind: 'audio';     url: string; label: string }
export type VideoSegment   = { kind: 'video';     url: string; label: string }
export type ToolSegment    = { kind: 'tool';      name: string; status: 'running' | 'done' | 'error'; summary?: string }

export type MessageSegment = TextSegment | ImageSegment | FileSegment | AudioSegment | VideoSegment | ToolSegment
```

`ChatMessage.text` remains for backward-compat (sessionStorage + terminal chat). A new optional `segments?: MessageSegment[]` is additive; renderers fall back to `text` when `segments` is absent.

### 2.2 Stream route — tool progress forwarding

New SSE frame type emitted by the proxy:
```json
{ "tool": { "name": "web_search", "status": "running", "summary": "Searching…" } }
```
```json
{ "tool": { "name": "web_search", "status": "done", "summary": "Found 3 results" } }
```

The client SSE reader in `useAstrbotChat` will parse these alongside `{ token }` frames and mutate the current bot message's `segments` array.

### 2.3 `astrbot-chat.tsx` — full refactor to hook

Replace the 300-line inline implementation with a thin renderer that consumes `useAstrbotChat`, matching the pattern already used in `Live2DChat`. Shared `<ChatPanel>` render component used by both surfaces.

### 2.4 Shared `<ChatPanel>` component (new)

`components/redesign/chat-panel.tsx` — renders the panel body, header, footer, and all message types. Both `AstrbotChat` and `Live2DChat` import it. This eliminates duplication and ensures the bubble panel gets Markdown rendering.

### 2.5 Message segment renderer

`components/redesign/message-renderer.tsx` — renders a `MessageSegment[]`:
- `text` → `<ReactMarkdown>` (same as Live2D today)
- `image` → graceful `<MdImage>` with error fallback
- `file` → download chip `[📎 filename]`
- `audio` → inline `<audio controls>` element
- `video` → inline `<video controls>` element
- `tool` (running) → pulsing card: `🔍 web_search — Searching…`
- `tool` (done) → collapsed card: `✓ web_search — Found 3 results`
- `tool` (error) → `⚠ web_search failed`

### 2.6 Humanoid chat pacing

Three additions to `useAstrbotChat`:

**a) Typing rhythm delay** — before the first token of a bot reply appears, wait `min(600, max(200, rand()*400))` ms with only the typing indicator showing. This avoids the jarring instant-replace of the spinner.

**b) Tool progress in-message cards** — while `tool` segments with `status: 'running'` exist in the message, show them as an animated pill above the text. When `status: 'done'` arrives, collapse them to a single-line summary (folds in with a CSS transition).

**c) Mood tint** — scan the first 80 chars of a bot reply for emotional tokens and apply a CSS data-attribute (`data-mood="playful"|"warm"|"sharp"|"neutral"`) to the message bubble. CSS then applies a subtle left-border tint per mood. This is purely presentational and requires no LLM change.

Mood tokens (simple keyword map, no ML):
- `playful`: nep, haha, ～, ♪, lol, heehee, XD
- `warm`: thank, welcome, help, sure, happy, glad, 谢, 嗯
- `sharp`: hmph, whatever, don't, won't, tsk, ugh

---

## 3. Animation Overlay System

### 3.1 Component: `TriggerAnimationOverlay`

`components/redesign/trigger-animation-overlay.tsx`

- Portaled to `document.body`, `position: fixed; inset: 0; z-index: 9999; pointer-events: none`
- Plays a CSS-keyframe catgirl animation for 2.5 s then unmounts
- Respects `prefers-reduced-motion` (skips the animation, shows a 0.5s flash instead)

### 3.2 Trigger detection

Checked on **both** outgoing user messages and incoming bot messages:

```ts
// lib/chat/trigger-words.ts
export type AnimationType = 'wave' | 'laugh' | 'blush' | 'sparkle' | 'heart' | 'konnichiwa'

export const TRIGGER_MAP: Record<string, AnimationType> = {
  // Greetings
  'nihao': 'konnichiwa',  'ni hao': 'konnichiwa',
  'konnichiwa': 'konnichiwa',  'konichiwa': 'konnichiwa',
  'hello': 'wave',  'hey': 'wave',  'hi': 'wave',
  // Laughter
  'haha': 'laugh',  'hehe': 'laugh',  'lol': 'laugh',  'xd': 'laugh',  '哈哈': 'laugh',
  // Romance / lewd
  'hentai': 'blush',  '变态': 'blush',  'baka': 'blush',  '色色': 'blush',
  // Positive
  'kawaii': 'sparkle',  '可爱': 'sparkle',  'cute': 'sparkle',
  'love': 'heart',  'suki': 'heart',  '喜欢': 'heart',  '爱你': 'heart',
}
```

Detection: normalise to lowercase, strip punctuation, check for exact word boundary match. Case-insensitive. Multi-word triggers supported. One animation at a time — if two triggers are in the same message, pick the highest-priority one.

### 3.3 Animation variants (CSS-only catgirl theme)

Each variant is a named keyframe set + a positioned catgirl motif (SVG/emoji composition). No external assets required for MVP — uses emoji + CSS filters + transforms.

| Variant | Visual | Keyframes |
|---|---|---|
| `wave` | 🐱✋ slides in from side, waves | `slideInWave` |
| `laugh` | 😹 bounces + shakes | `bounceShake` |
| `blush` | 😳 catgirl face zooms in, pink radial glow | `blushZoom` |
| `sparkle` | ✨ burst of sparkle particles from centre | `sparkleBurst` |
| `heart` | 💕 hearts float up | `heartFloat` |
| `konnichiwa` | 🐱🎌 bow + Japanese text flash | `konnichiwaSlide` |

Advanced phase (post-MVP): replace emoji with actual catgirl PNG/GIF frames from `public/redesign/catgirl/` directory.

### 3.4 Integration point

Add `useTriggerAnimation` hook to `useAstrbotChat`:
- Watch the last `messages` entry whenever it changes
- If the last message (user or bot) contains a trigger word → fire the animation
- Debounced — same trigger within 3 s doesn't replay

The overlay is rendered inside `AstrbotChat` and `Live2DChat` via a `<TriggerAnimationOverlay />` element.

---

## 4. Component Tree (after implementation)

```
AstrbotChat (bubble renderer)
  └── useAstrbotChat()
  └── useTriggerAnimation()
  └── <ChatPanel>           ← shared
        └── <MessageRenderer segments={...} />
        └── <TriggerAnimationOverlay />

Live2DChat
  └── useAstrbotChat()
  └── useTriggerAnimation()
  └── <ChatPanel>           ← same shared component
        └── <MessageRenderer segments={...} />
        └── <TriggerAnimationOverlay />
```

---

## 5. Data Flow

```
User types → send() → /api/astrbot/chat/stream (POST)
                          │
                    streamAstrBot()
                          │
                 ┌────────┴────────────┐
                 │  AstrBot SSE frames  │
                 │                      │
           plain/complete           tool_call frames
                 │                      │
           { token: "..." }      { tool: { name, status } }
                 │                      │
                 └────────┬─────────────┘
                          │
                   Client SSE reader
                   (useAstrbotChat)
                          │
                  ┌───────┴────────────┐
                  │                    │
           pushToken(text)    pushToolFrame(frame)
                  │                    │
           segments: [           segments: [
             text chunk            ...,
           ]                       { kind:'tool', status:'running' }
                                 ]
                  └───────┬────────────┘
                          │
                   <MessageRenderer>
                   renders both in order
```

---

## 6. Files Changed

| File | Change |
|---|---|
| `lib/chat/message-segments.ts` | **new** — segment types |
| `lib/chat/trigger-words.ts` | **new** — trigger map + detector |
| `lib/chat/use-astrbot-chat.ts` | extend: `segments` in state, tool frame parsing, typing delay, trigger hook |
| `app/api/astrbot/chat/stream/route.ts` | emit `{ tool: {...} }` SSE frames for non-`send_message_to_user` tool calls |
| `app/api/astrbot/chat/route.ts` | inject persona prefix for attachments (parity fix) |
| `components/redesign/message-renderer.tsx` | **new** — per-segment renderer |
| `components/redesign/chat-panel.tsx` | **new** — shared panel JSX (header, body, footer) |
| `components/redesign/trigger-animation-overlay.tsx` | **new** — full-screen animation |
| `components/redesign/astrbot-chat.tsx` | refactor to use hook + `<ChatPanel>` |
| `components/redesign/live2d-chat.tsx` | swap inline JSX for `<ChatPanel>` |
| `app/redesign-styles/09-astrbot.css` | add mood tints, tool card styles, animation keyframes |

---

## 7. Out of Scope (this iteration)

- Replacing emoji catgirl animations with PNG/GIF sprite assets (phase 2)
- Persistent emoji reactions stored in Supabase
- Voice/audio message recording from the browser
- Real-time "is typing" signal from AstrBot server-push
- Custom trigger word configuration UI

---

## 8. Success Criteria

1. `astrbot-chat.tsx` uses `useAstrbotChat` — zero duplicated state logic
2. Tool call progress shows in the message stream (not a blank wait)
3. Image, file, audio, video segments render as native elements (not raw URLs)
4. Trigger words fire full-screen animation within 100 ms of message render
5. Both bubble panel and Live2D panel render identically via `<ChatPanel>`
6. `prefers-reduced-motion` skips keyframe animation but shows a flash
7. `npm run build` clean, `npx tsc --noEmit` zero errors
