// Message-board moderation — layered, deterministic, zero-dependency.
//
//   1. normalise   strip zero-width chars and separator-evasion (f.u.c.k)
//   2. block       slurs / explicit sexual content / aggression / illegal-
//                  service spam / mainland-sensitive terms → reject with a
//                  friendly reason (never echo the matched word back)
//   3. mask        mild profanity → ✱✱ in place, entry still posts
//   4. spam shape  link floods, contact-bait, character floods → reject
//
// The lists are intentionally pragmatic, not exhaustive: the guestbook is a
// small personal site's wall, and rate-limiting + manual cleanup remain the
// backstop. Patterns avoid common false positives (Scunthorpe-safe word
// boundaries for Latin, exact substrings for CJK).

export type ModerationResult =
  | { ok: true; text: string; masked: boolean }
  | { ok: false; reason: string };

const REJECT_MESSAGE = '留言包含不适合展示的内容，请修改后再试 / message contains content we can\'t display';
const SPAM_MESSAGE = '留言看起来像广告或刷屏，请写点真话吧 / looks like spam — write something real';

// ── 1 · normalisation ───────────────────────────────────────────────────────

/** Zero-width + bidi control chars used to split banned words. */
const INVISIBLES = /[​-‏⁠﻿­]/g;

export function normalizeForModeration(text: string): string {
  return text.replace(INVISIBLES, '');
}

/** Latin collapsed for evasion matching: lowercase, separators removed. */
function collapsedLatin(text: string): string {
  return text.toLowerCase().replace(/[\s._\-*+|/\\]+/g, '');
}

// ── 2 · hard blocks ─────────────────────────────────────────────────────────

// Latin patterns run on the collapsed text, so they need no boundary on the
// inside but use lookarounds to avoid Scunthorpe-style false hits.
const BLOCK_LATIN: RegExp[] = [
  /n[i1]gg(?:er|a)/, /fagg?[o0]t/, /\bk[i1]ke/, /ch[i1]nk(?:s|y)?\b/,
  /cunt/, /\bporn(?:hub|o)?\b/, /child\s*p[o0]rn/, /loli(?:con)?hentai|hentailoli/,
  /\bget(?:rich|paid)quick/, /casinobonus|onlinecasino|bet365|porno?site/,
];
// CJK exact substrings (run on normalised original).
const BLOCK_CJK: string[] = [
  '操你妈', '草你妈', '日你妈', '艹你妈', '肏', '妈卖批', '马卖批', '死全家', '全家死',
  '杀了你', '弄死你', '强奸', '轮奸', '幼女', '嫖娼', '卖淫', '约炮', '一夜情上门',
  '代开发票', '办证刷单', '加我微信赚', '快速贷款', '博彩平台', '赌场上分', '六合彩',
  '法轮', '六四事件', '天安门事件', '反党', '颠覆国家',
];

// ── 3 · maskable (mild) profanity → ✱✱ ─────────────────────────────────────

const MASK_LATIN: RegExp[] = [
  /\bfuck(?:ing|er|ed)?\b/gi, /\bshit(?:ty)?\b/gi, /\bbitch(?:es)?\b/gi,
  /\basshole\b/gi, /\bwtf\b/gi, /\bdamn\b/gi,
];
const MASK_CJK: string[] = ['傻逼', '煞笔', '沙比', '卧槽', '我操', '我草', '尼玛', '你妈的', '妈的', '他妈的', '滚蛋', '去死'];

// ── 4 · spam shape ──────────────────────────────────────────────────────────

const URL_RE = /https?:\/\/|www\./gi;
const CONTACT_BAIT = /(加|\+)\s*(微信|vx|wx|qq|q群|telegram|tg)\s*[:：]?\s*[a-z0-9_\-]{4,}/i;

function looksLikeSpam(text: string): boolean {
  const urls = text.match(URL_RE)?.length ?? 0;
  if (urls > 1) return true;
  if (CONTACT_BAIT.test(text)) return true;
  if (/(.)\1{11,}/.test(text)) return true;                 // 12+ same char run
  const stripped = text.replace(/\s/g, '');
  if (stripped.length >= 20) {
    const unique = new Set(stripped).size;
    if (unique <= 3) return true;                            // "哈哈哈哈…" walls etc.
  }
  return false;
}

// ── entry point ─────────────────────────────────────────────────────────────

export function moderateMessage(raw: string): ModerationResult {
  const text = normalizeForModeration(raw);
  const collapsed = collapsedLatin(text);

  for (const re of BLOCK_LATIN) {
    if (re.test(collapsed)) return { ok: false, reason: REJECT_MESSAGE };
  }
  for (const term of BLOCK_CJK) {
    if (text.includes(term)) return { ok: false, reason: REJECT_MESSAGE };
  }
  if (looksLikeSpam(text)) return { ok: false, reason: SPAM_MESSAGE };

  let cleaned = text;
  let masked = false;
  for (const re of MASK_LATIN) {
    cleaned = cleaned.replace(re, (m) => { masked = true; return '✱'.repeat(Math.min(m.length, 4)); });
  }
  for (const term of MASK_CJK) {
    if (cleaned.includes(term)) {
      masked = true;
      cleaned = cleaned.split(term).join('✱✱');
    }
  }

  return { ok: true, text: cleaned, masked };
}

// Names dodge \b boundaries with underscores/digits (fuck_lord), so the name
// path re-checks mild profanity against the collapsed string too.
const NAME_COLLAPSED_REJECT: RegExp[] = [/fuck/, /shit(?!ake)/, /bitch/, /asshole/, /cunt/];

/** Names get the same treatment but stricter: no masking — a starred name
 *  looks broken on the wall, so anything maskable is rejected outright. */
export function moderateName(raw: string): ModerationResult {
  const result = moderateMessage(raw);
  if (!result.ok) return result;
  if (result.masked) return { ok: false, reason: REJECT_MESSAGE };
  const collapsed = collapsedLatin(normalizeForModeration(raw));
  for (const re of NAME_COLLAPSED_REJECT) {
    if (re.test(collapsed)) return { ok: false, reason: REJECT_MESSAGE };
  }
  return result;
}
