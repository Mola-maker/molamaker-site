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
