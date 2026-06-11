// Miku stage directions — the shared vocabulary between the chat LLM and the
// page's two performers: the Live2D mascot + fullscreen stage scenes
// (MikuStage) and the tiny wandering sprite (MikuFairy). Bot replies may end
// with a tag like [miku:concert]; the chat hook strips it from the visible
// text and dispatches a `miku:perform` CustomEvent that the performers act
// out. Visitor messages are scanned for command keywords so the page reacts
// the instant you hit send, before the model has replied.

/** Small actions performed by the chibi sprite (and echoed by the Live2D
 *  mascot when it's on stage). */
export const SPRITE_ACTIONS = [
  // motion & play
  'dance',
  'spin',
  'jump',
  'wave',
  'hearts',
  'sing',
  'hide',
  'swim',
  'sleep',
  'zoom',
  'bounce',
  'chase',
  // emotions
  'shy',
  'cry',
  'laugh',
  'kiss',
  'angry',
  'think',
  'cheer',
  'dizzy',
  'wink',
  'stretch',
  // little hobbies
  'magic',
  'photo',
  'fish',
  'doodle',
  'vibe',
  'paint',
  // the hide-and-seek game (3 rounds; winning earns a painting)
  'seek',
] as const;

/** Fullscreen cinematic scenes rendered by MikuStage: page dims, the Live2D
 *  model takes center stage, and a canvas particle system runs the show. */
export const SCENE_ACTIONS = [
  'concert',
  'fireworks',
  'sakura',
  'stars',
  'snow',
  'confetti',
] as const;

export const MIKU_ACTIONS = [...SPRITE_ACTIONS, ...SCENE_ACTIONS] as const;

export type SpriteAction = (typeof SPRITE_ACTIONS)[number];
export type SceneAction = (typeof SCENE_ACTIONS)[number];
export type MikuAction = (typeof MIKU_ACTIONS)[number];

const TAG_RE = /\[(?:miku|mola):\s*([a-z-]+)\s*\]/gi;

export function isMikuAction(name: string): name is MikuAction {
  return (MIKU_ACTIONS as readonly string[]).includes(name);
}
export function isSpriteAction(name: string): name is SpriteAction {
  return (SPRITE_ACTIONS as readonly string[]).includes(name);
}
export function isSceneAction(name: string): name is SceneAction {
  return (SCENE_ACTIONS as readonly string[]).includes(name);
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
// "dance and sing!" doesn't queue a double performance. Big-production scenes
// are matched before small sprite moves.
const USER_COMMANDS: Array<[RegExp, MikuAction]> = [
  [/concert|演唱会|开唱|开个?\s*live|live\s*show|舞台|stage\s*time/i, 'concert'],
  [/firework|烟花|放个?烟火/i, 'fireworks'],
  [/sakura|樱花|花瓣|花吹雪/i, 'sakura'],
  [/meteor|流星|星空|shooting\s*star|银河|stars?\b/i, 'stars'],
  [/\bsnow\b|下雪|雪花/i, 'snow'],
  [/confetti|撒花|庆祝|celebrate|恭喜|congrats/i, 'confetti'],
  // hobbies & props (before the generic moves so "画个爱心" beats "爱心")
  [/hide.?and.?seek|捉迷藏|玩个?游戏|play\s*(a\s*)?game|来玩/i, 'seek'],
  [/paint|画一?幅|作画|画张画|油画/i, 'paint'],
  [/magic|魔法|变个?魔术|变个戏法/i, 'magic'],
  [/photo|拍照|咔嚓|selfie|自拍/i, 'photo'],
  [/\bfish(ing)?\b|钓鱼|垂钓/i, 'fish'],
  [/doodle|涂鸦|画个|画画/i, 'doodle'],
  [/\bvibe\b|律动|摇摆|听歌|跟着节奏/i, 'vibe'],
  [/trampoline|蹦床|弹跳|bounce/i, 'bounce'],
  [/catch me|来抓我|追我|chase/i, 'chase'],
  // emotions
  [/\bshy\b|害羞|脸红/i, 'shy'],
  [/\bcry\b|哭|呜呜|嘤嘤/i, 'cry'],
  [/laugh|大笑|笑一个|逗我/i, 'laugh'],
  [/kiss|飞吻|亲亲|mua|么么/i, 'kiss'],
  [/angry|生气|哼!|气鼓鼓/i, 'angry'],
  [/think|思考|想一想|沉思/i, 'think'],
  [/cheer|加油|应援|打气/i, 'cheer'],
  [/dizzy|头晕|晕了/i, 'dizzy'],
  [/wink|眨眼|wink一个/i, 'wink'],
  [/stretch|伸个?懒腰|拉伸/i, 'stretch'],
  // classic moves
  [/dance|跳舞|跳支舞|跳个舞|💃/i, 'dance'],
  [/spin|twirl|转圈|旋转/i, 'spin'],
  [/\bjump\b|\bhop\b|跳一下|蹦一个/i, 'jump'],
  [/\bwave\b|挥手|打个招呼/i, 'wave'],
  [/比心|爱你|love you|❤|💕|发个爱心/i, 'hearts'],
  [/\bsing\b|唱歌|唱首歌|唱个歌/i, 'sing'],
  [/hide|躲猫猫|藏起来/i, 'hide'],
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
 *  performers. Kept terse — it rides along on every request. */
export const MIKU_ACTIONS_PROMPT =
  'You can also direct live animations on this page by appending ONE tag at the very END of a reply. ' +
  'Fullscreen spectacles (use when the visitor asks for a show, a surprise, or the moment is big): ' +
  '[miku:concert] full stage-live with spotlights and penlights, [miku:fireworks] night-sky firework show, ' +
  '[miku:sakura] cherry-blossom petal storm, [miku:stars] starfield with shooting stars, ' +
  '[miku:snow] gentle snowfall, [miku:confetti] confetti celebration. ' +
  'Small gestures (everyday emotional beats): [miku:dance] [miku:spin] [miku:jump] [miku:wave] ' +
  '[miku:hearts] [miku:sing] [miku:hide] [miku:swim] [miku:sleep] [miku:zoom] [miku:bounce] [miku:chase] ' +
  '[miku:shy] [miku:cry] [miku:laugh] [miku:kiss] [miku:angry] [miku:think] [miku:cheer] [miku:dizzy] ' +
  '[miku:wink] [miku:stretch] [miku:magic] [miku:photo] [miku:fish] [miku:doodle] [miku:vibe]. ' +
  'Special: [miku:paint] she paints a small artwork live, brushstroke by brushstroke, and hangs it in the ' +
  "magazine gallery; [miku:seek] starts a 3-round hide-and-seek game (find her with the cursor — winning " +
  'earns a painting). ' +
  'Pick the one that best matches the mood; use a fullscreen spectacle whenever the visitor explicitly asks ' +
  'for an animation, show, or celebration. Never mention or explain the tag itself.';
