// Miku stage directions — the shared vocabulary between the chat LLM and the
// on-page MikuFairy sprite. Bot replies may end with a tag like [miku:dance];
// the chat hook strips it from the visible text and dispatches a
// `miku:perform` CustomEvent that the sprite acts out. Visitor messages are
// scanned for command keywords so Miku reacts the instant you hit send,
// before the model has replied.

export const MIKU_ACTIONS = [
  'dance',
  'spin',
  'jump',
  'wave',
  'hearts',
  'fireworks',
  'sing',
  'hide',
  'swim',
  'sleep',
  'zoom',
] as const;

export type MikuAction = (typeof MIKU_ACTIONS)[number];

const TAG_RE = /\[(?:miku|mola):\s*([a-z-]+)\s*\]/gi;

export function isMikuAction(name: string): name is MikuAction {
  return (MIKU_ACTIONS as readonly string[]).includes(name);
}

/** Pull `[miku:…]` tags out of a bot reply: returns the recognised actions and
 *  the reply text with all tags removed (unknown tags are dropped too). */
export function extractMikuActions(text: string): { actions: MikuAction[]; cleaned: string } {
  const actions: MikuAction[] = [];
  const cleaned = text
    .replace(TAG_RE, (_m, name: string) => {
      const a = name.toLowerCase();
      if (isMikuAction(a) && !actions.includes(a)) actions.push(a);
      return '';
    })
    .replace(/[ \t]+$/gm, '');
  return { actions, cleaned: cleaned.trimEnd() };
}

/** Display-time strip for streaming surfaces — tags vanish from the rendered
 *  markdown as soon as their closing bracket arrives. */
export function stripMikuTags(text: string): string {
  return text.replace(TAG_RE, '');
}

// Visitor-message keyword commands (en + zh). Only the first match fires so
// "dance and sing!" doesn't queue a double performance.
const USER_COMMANDS: Array<[RegExp, MikuAction]> = [
  [/dance|跳舞|跳支舞|跳个舞|💃/i, 'dance'],
  [/spin|twirl|转圈|旋转/i, 'spin'],
  [/\bjump\b|\bhop\b|跳一下|蹦一个/i, 'jump'],
  [/\bwave\b|挥手|打个招呼/i, 'wave'],
  [/比心|爱你|love you|❤|💕|发个爱心/i, 'hearts'],
  [/firework|烟花|庆祝|celebrate/i, 'fireworks'],
  [/\bsing\b|唱歌|唱首歌|唱个歌/i, 'sing'],
  [/hide|捉迷藏|躲猫猫|藏起来/i, 'hide'],
  [/\bswim\b|游泳|游个泳/i, 'swim'],
  [/晚安|睡觉|go to sleep|good\s*night/i, 'sleep'],
  [/\bzoom\b|\bfly\b|飞一个|冲刺/i, 'zoom'],
];

export function actionsFromUserText(text: string): MikuAction[] {
  for (const [re, action] of USER_COMMANDS) {
    if (re.test(text)) return [action];
  }
  return [];
}

/** Appended to every Live2D persona system prompt so the model can direct the
 *  sprite. Kept terse — it rides along on every request. */
export const MIKU_ACTIONS_PROMPT =
  'A tiny animated Miku sprite lives on this page and performs stage directions. ' +
  'When the visitor asks for an animation/performance, or a strong emotion fits your reply, ' +
  'append exactly one tag at the very END of your reply, chosen from: ' +
  '[miku:dance] [miku:spin] [miku:jump] [miku:wave] [miku:hearts] [miku:fireworks] ' +
  '[miku:sing] [miku:hide] [miku:swim] [miku:sleep] [miku:zoom]. ' +
  'Use a tag only when it adds delight, never more than one, and never mention or explain the tag itself.';
