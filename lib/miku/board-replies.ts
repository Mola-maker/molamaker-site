// Miku's message-board voice — deterministic, keyword-matched replies the
// 看板娘 speaks when someone signs the guestbook (and that the board shows
// under the fresh entry). No LLM round-trip: posting must feel instant, and
// a canned-but-situational line in her voice beats a slow generic one.

interface ReplyRule { re: RegExp; lines: string[] }

const RULES: ReplyRule[] = [
  { re: /喜欢|love|like|好看|漂亮|beautiful|awesome|amazing|great|nice|棒|赞|cool|不错/i,
    lines: ['谢谢喜欢! 我会继续加油的 ♪', '诶嘿嘿…被夸到了 ///', '{name} 的眼光真好! ✧'] },
  { re: /miku|未来|ミク|初音/i,
    lines: ['有人叫我? 是 {name}! ♪', '初音未来、随时待命!', '记住你了哦, {name} ✧'] },
  { re: /画|paint|gallery|美术馆|art/i,
    lines: ['美术馆看过了吗? 都是我画的哦 ✎', '下一幅画就献给 {name}!', '要不要委托我画一幅? ♪'] },
  { re: /歌|music|song|sing|曲|演唱会|concert/i,
    lines: ['想听歌? 跟我说「开演唱会」! ♪', '音乐是我的生命~ {name} 也喜欢吗?', '♪~ 下次唱给你听'] },
  { re: /加油|努力|fight|顶|支持/i,
    lines: ['一起加油, {name}! ファイト!', '你的支持收到了 ✧ 满血复活!', '嗯! 会努力的 ♪'] },
  { re: /你好|hello|hi|hey|哈喽|嗨/i,
    lines: ['你好呀 {name}~ 欢迎来玩!', 'こんにちは, {name}! ♪', '欢迎欢迎! 这里到处都可以逛 ✧'] },
  { re: /再见|拜拜|bye|goodbye|走了/i,
    lines: ['要走了吗? 路上小心, 常回来 ♪', '拜拜 {name}~ 我会想你的!', 'またね! ✧'] },
  { re: /问题|bug|错误|broken|issue|坏/i,
    lines: ['诶? 我去戳戳站长! 谢谢反馈 ✧', '收到! 马上记到小本本上 ✎'] },
];

const FALLBACK = [
  '谢谢留言, {name}! 已经贴到墙上了 ✎',
  '{name} 的留言收到! 比心 ❤',
  '哇, 新留言! 谢谢 {name} ♪',
  '留言板又热闹了一点, 谢谢 {name} ✧',
];

function pickStable(lines: string[], seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return lines[h % lines.length];
}

/** A reply in Miku's voice for a fresh guestbook entry. Deterministic for a
 *  given (message, name) so the board and the mascot say the same thing. */
export function mikuBoardReply(message: string, name: string): string {
  const cleanName = name.trim().slice(0, 24) || '朋友';
  for (const rule of RULES) {
    if (rule.re.test(message)) {
      return pickStable(rule.lines, message + cleanName).replaceAll('{name}', cleanName);
    }
  }
  return pickStable(FALLBACK, message + cleanName).replaceAll('{name}', cleanName);
}
