# API Reference

molamaker-site exposes three mutation endpoints: two Server Actions for user-generated content and one REST endpoint for analytics.

---

## Shared Types

### `ApiResult<T>`

```ts
// lib/types.ts
type ApiResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };
```

All mutation endpoints return an `ApiResult`. Check `ok` to discriminate success from error.

---

## Server Actions

Both Server Actions are defined in `app/actions.ts`. They are callable from Client Components via `"use server"` import.

### `signGuestbook(formData: FormData): Promise<ApiResult>`

Sign the guestbook with a name and message.

| Field     | Type   | Rules                                                        |
| --------- | ------ | ------------------------------------------------------------ |
| `name`    | string | 1-40 chars, trimmed, HTML-sanitized                          |
| `message` | string | 1-240 chars, trimmed, safe-text regex (`SAFE_TEXT_RE`), HTML-sanitized |

**Returns:**

- `{ ok: true }` -- entry persisted; ISR cache for `/` revalidated
- `{ error: string }` -- validation failed, rate limited, or DB insert error

**Rate limit:** per-IP token bucket. 5 entries per 60 seconds (`RATE_GUESTBOOK`).

**Side effects:** calls `revalidatePath('/')` to refresh the home page ISR cache after a successful insert.

---

### `sendContact(formData: FormData): Promise<ApiResult>`

Send a contact message.

| Field     | Type   | Rules                                                     |
| --------- | ------ | --------------------------------------------------------- |
| `name`    | string | 0-80 chars, trimmed, HTML-sanitized (optional)            |
| `email`   | string | valid email or empty string, max 200 chars. Empty coerced to `null` |
| `subject` | string | 0-200 chars, trimmed, HTML-sanitized (optional)           |
| `message` | string | 1-5000 chars, trimmed, safe-text regex, HTML-sanitized    |

**Returns:**

- `{ ok: true }` -- message persisted
- `{ error: string }` -- validation failed, rate limited, or DB insert error

**Rate limit:** per-IP token bucket. 3 messages per 60 seconds (`RATE_CONTACT`).

---

## REST Endpoints

### `POST /api/views`

Record a page view for the analytics pipeline.

**Request:**

```json
{ "path": "/blog/my-post" }
```

| Field  | Type   | Rules                                                  |
| ------ | ------ | ------------------------------------------------------ |
| `path` | string | 1-500 chars, must start with `/`, must not contain `..` |

**Responses:**

| Status | Body             | Headers                 | Meaning                       |
| ------ | ---------------- | ----------------------- | ----------------------------- |
| 200    | `{ ok: true }`   | --                      | View recorded                 |
| 400    | `{ ok: false }`  | --                      | Invalid JSON or path          |
| 429    | `{ ok: false }`  | `Retry-After: <seconds>` | Rate limited                  |
| 500    | `{ ok: false }`  | --                      | Server or database error       |

**Rate limit:** per-IP token bucket. 60 pings per 60 seconds (`RATE_VIEWS`).

**Caller:** this endpoint is called by `middleware.ts` as a fire-and-forget `fetch`. No authentication is required.

---

## Validation Schemas

All input validation uses [Zod](https://zod.dev) schemas defined in `lib/validation.ts`.

### `guestbookSchema`

```ts
z.object({
  name:    z.string().trim().min(1).max(40).transform(sanitize),
  message: z.string().trim().min(1).max(240).pipe(safeText).transform(sanitize),
})
```

### `contactSchema`

```ts
z.object({
  name:    z.string().trim().max(80).transform(sanitize),
  email:   z.string().trim().max(200).email().or(z.literal('')).transform(s => s || null),
  subject: z.string().trim().max(200).transform(sanitize),
  message: z.string().trim().min(1).max(5000).pipe(safeText).transform(sanitize),
})
```

### `pageViewSchema`

```ts
z.object({
  path: z.string().min(1).max(500).refine(p => p.startsWith('/') && !p.includes('..')),
})
```

### Sanitization

The `sanitize` helper escapes `&`, `<`, `>`, `"`, and `'` to their HTML entities. The `safeText` regex (`SAFE_TEXT_RE`) permits Unicode letters, numbers, spaces, hyphens, underscores, and common punctuation -- blocking control characters and script-injection vectors.

---

## Rate Limiting

The rate limiter (`lib/rate-limit.ts`) uses an in-memory token-bucket algorithm per process. Constants:

| Constant          | Limit | Window  | Used By              |
| ----------------- | ----- | ------- | -------------------- |
| `RATE_GUESTBOOK`  | 5     | 60 s    | `signGuestbook`      |
| `RATE_CONTACT`    | 3     | 60 s    | `sendContact`        |
| `RATE_VIEWS`      | 60    | 60 s    | `POST /api/views`    |

Each bucket is keyed by action prefix + client IP (e.g. `"gb:192.168.1.1"`). Inactive buckets are cleaned up after 10 minutes.

**Note:** the token bucket is per-process (not shared across Vercel Lambda instances). For production, consider an external store (Upstash Redis) if consistent rate limiting across serverless instances is required.
