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
