export type Mood = 'playful' | 'warm' | 'sharp' | 'neutral'

export function detectMood(text: string): Mood {
  const t = text.toLowerCase().slice(0, 80)
  if (/nep|haha|hehe|～|♪|lol|heehee|xd|yay|whee|wow/.test(t)) return 'playful'
  if (/thank|welcome|help|sure|happy|glad|谢|嗯|great|good to hear/.test(t)) return 'warm'
  if (/hmph|whatever|don't|won't|tsk|ugh|boring|annoying/.test(t)) return 'sharp'
  return 'neutral'
}
