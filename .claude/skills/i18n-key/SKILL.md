---
name: i18n-key
description: Add a new translation key to both messages/en.json and messages/zh.json, maintaining structure
---

The user wants to add a new i18n translation key.

They will provide:
- The key path (e.g. `nav.notifications` or `home.welcomeBack`)
- The English value
- Optionally, the Chinese value (if not provided, use a placeholder and flag it)

## Steps

1. Read `messages/en.json` and `messages/zh.json` to understand the current structure.

2. Parse the key path and insert at the correct nesting level.
   - Key `nav.notifications` → add `"notifications": "..."` inside the `"nav"` object
   - Key `home.newSection.title` → create `"newSection": { "title": "..." }` inside `"home"`

3. Edit **both** files:
   - `messages/en.json` — insert the English value
   - `messages/zh.json` — insert the Chinese value (or `"[NEEDS_TRANSLATION]"` if not provided)

4. Maintain alphabetical key order within each namespace object.

5. Show the usage example in a component:
```tsx
// Server Component
import { getTranslations } from 'next-intl/server'
const t = await getTranslations('nav')
t('notifications')

// Client Component
import { useTranslations } from 'next-intl'
const t = useTranslations('nav')
t('notifications')
```

6. If `"[NEEDS_TRANSLATION]"` was used, remind the user to add the real Chinese translation before deploying.

## Stack Reference
- next-intl v4
- Locales: `en`, `zh`
- Message files: `messages/en.json`, `messages/zh.json`
- Server: `getTranslations('namespace')` (async)
- Client: `useTranslations('namespace')` (sync, Client Component only)
