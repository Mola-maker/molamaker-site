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
