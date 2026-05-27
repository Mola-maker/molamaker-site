// Ported from molamakersite (1)/data.js — static mock data for the 4 home variants.
// Kept as a plain TS module instead of a window global so it can be tree-shaken
// and type-checked. API-backed data (chat, guestbook, views) is wired separately;
// this only powers the visual prototype copy.

export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: number;
  tag: string;
};

export type Repo = {
  name: string;
  desc: string;
  lang: string;
  langColor: string;
  stars: number;
  updated: string;
};

export type Guest = {
  name: string;
  message: string;
  t: string;
  _new?: boolean;
};

export type NowPlaying = {
  title: string;
  artist: string;
  album: string;
  progress: number;
};

export type Status = {
  location: string;
  locationCn: string;
  learning: string;
  weather: string;
  tz: string;
};

export type CommitFile = { path: string; plus: number; minus: number };

export type Signal =
  | {
      kind: 'commit';
      time: string;
      repo: string;
      message: string;
      branch: string;
      meta?: string;
      hash?: string;
      author?: string;
      issue?: string;
      files?: CommitFile[];
      diff?: string;
    }
  | {
      kind: 'song';
      time: string;
      title: string;
      artist: string;
      album: string;
      cover: string;
      progress: number;
      length: string;
      position: string;
      bpm: number;
      key: string;
      mood: string;
      recent: string[];
      lyricsPreview?: Array<{ time: number; text: string }>;
    }
  | {
      kind: 'post';
      time: string;
      title: string;
      slug: string;
      meta: string;
      words: number;
      tag: string;
      excerpt: string;
      toc: string[];
      reactions: { heart: number; brain: number; fire: number };
    }
  | {
      kind: 'guestbook';
      time: string;
      name: string;
      message: string;
      country: string;
      accent: string;
    }
  | { kind: 'visitor'; time: string; value: number; today: number; week: number }
  | {
      kind: 'learning';
      time: string;
      value: string;
      depth: number;
      source: string;
      notes: string[];
    }
  | { kind: 'deploy'; time: string; env: string; status: string; version: string }
  | { kind: 'note'; time: string; text: string }

export type Zone = {
  id: string;
  label: string;
  x: number;
  y: number;
  count: number | string;
  hint: string;
};

export type AtlasSubNode = { id: string; label: string; meta: string };

export type Locale = 'en' | 'zh';

export type I18nBlock = {
  nav: string[];
  eyebrow: string;
  h1: string[];
  lead: string;
  visitor: string;
  learning: string;
  based: string;
  now: string;
  writing: string;
  work: string;
  open: string;
  guests: string;
  reply: string;
  readAll: string;
  hello: string;
};

export const molaData = {
  visitor: 12473,

  posts: [
    {
      slug: 'agent-orchestration',
      title: 'Orchestrating agents without losing your mind',
      excerpt: 'Notes on what actually works when you put three LLMs in a trenchcoat and tell them to ship code.',
      date: '2026-05-18',
      readTime: 9,
      tag: 'systems',
    },
    {
      slug: 'kernel-rewrite',
      title: "I rewrote a CUDA kernel six times. Here's what stuck.",
      excerpt: 'Bank conflicts, occupancy, and the small joys of finally seeing the SM utilization climb past 80%.',
      date: '2026-05-04',
      readTime: 14,
      tag: 'cuda',
    },
    {
      slug: 'astrbot-plugin-design',
      title: 'Designing AstrBot plugins for humans, not just bots',
      excerpt: 'A plugin API is a UI. Treating it like one made everything easier.',
      date: '2026-04-22',
      readTime: 7,
      tag: 'tooling',
    },
    {
      slug: 'rotational-dynamics',
      title: 'Rotational dynamics, for the small hours',
      excerpt: 'A note on torque, inertia, and why nothing in physics is ever quite local.',
      date: '2026-03-30',
      readTime: 6,
      tag: 'notes',
    },
    {
      slug: 'linux-phone-tinkering',
      title: 'Linux on a pocket: a postcard from PostmarketOS',
      excerpt: 'What I learned daily-driving a phone whose root filesystem I could actually edit.',
      date: '2026-03-12',
      readTime: 11,
      tag: 'tinkering',
    },
  ] as Post[],

  repos: [
    { name: 'astrbot-plugins', desc: 'A curated set of plugins for the AstrBot ecosystem.', lang: 'TypeScript', langColor: '#3178C6', stars: 412, updated: '2h ago' },
    { name: 'kernel-notes', desc: 'My CUDA kernel sketchbook — timing notes, occupancy charts, gotchas.', lang: 'Cuda', langColor: '#6A55C2', stars: 287, updated: '1d ago' },
    { name: 'gstack', desc: 'A tiny grokking stack for elliptic-curve crypto experiments.', lang: 'Rust', langColor: '#DEA584', stars: 96, updated: '3d ago' },
    { name: 'omc', desc: 'OMC — an opinionated minimal compiler for educational purposes.', lang: 'OCaml', langColor: '#3BE133', stars: 54, updated: '1w ago' },
  ] as Repo[],

  guestbook: [
    { name: 'Ren', message: 'Your CUDA notes saved my final project. 万分感谢.', t: '14m ago' },
    { name: 'Aki', message: 'Came for the rotational dynamics, stayed for the typography.', t: '3h ago' },
    { name: 'haruka', message: 'pls write more about agent orchestration <3', t: 'yesterday' },
    { name: 'Wen', message: 'okay the opening sequence is genuinely cinema', t: '2d ago' },
  ] as Guest[],

  nowPlaying: {
    title: 'Polite Conversation',
    artist: 'Kabanagu',
    album: 'okosama suite',
    progress: 0.42,
  } as NowPlaying,

  status: {
    location: 'Jinlin· quiet desk',
    locationCn: '杭州 · 安静的书桌',
    learning: 'CUDA, agentic systems',
    weather: '23° light haze',
    tz: 'GMT+8',
  } as Status,

  signals: [
    {
      kind: 'commit', time: '00:14', repo: 'astrbot-plugins',
      message: 'fix: avoid double-counting tool tokens',
      meta: '+62 − 14', hash: '3f8a91c',
      branch: 'main', author: 'molamaker', issue: '#214',
      files: [
        { path: 'src/orchestrator/budget.ts', plus: 42, minus: 6 },
        { path: 'kernel/tile-quilt.cu',        plus: 20, minus: 0 },
        { path: 'src/orchestrator/legacy.ts',  plus: 0,  minus: 8 },
      ],
      diff: '@@ -14,6 +14,8 @@ class TokenBudget {\n-  spend(n) { this.used += n; }\n+  spend(n, tool) {\n+    this.used += n;\n+    this.byTool[tool] = (this.byTool[tool] || 0) + n;\n+  }',
    },
    {
      kind: 'song', time: '00:08',
      title: 'Polite Conversation', artist: 'Kabanagu', album: 'okosama suite',
      cover: '/redesign/miku-bg-2.gif',
      progress: 0.42, length: '3:48', position: '1:35',
      bpm: 92, key: 'F# minor', mood: 'soft / late',
      recent: ['Polite Conversation', 'Redial', 'Tell Your World', 'Senbonzakura'],
    },
    {
      kind: 'post', time: '− 6h',
      title: 'Orchestrating agents without losing your mind',
      slug: 'agent-orchestration',
      meta: '9 min read', words: 1840,
      tag: 'systems',
      excerpt: 'Notes on what actually works when you put three LLMs in a trenchcoat and tell them to ship code.',
      toc: ['The trenchcoat fallacy', 'Budgets, not battles', 'When to let one agent talk', 'Closing notes'],
      reactions: { heart: 28, brain: 11, fire: 7 },
    },
    {
      kind: 'guestbook', time: '− 14m',
      name: 'Ren', message: 'Your CUDA notes saved my final project. 万分感谢.',
      country: 'TW', accent: '#3E7C5F',
    },
    { kind: 'visitor', time: 'now', value: 12473, today: 218, week: 1394 },
    {
      kind: 'learning', time: '—',
      value: 'occupancy & bank conflicts',
      depth: 0.62,
      source: 'CUDA C++ Programming Guide ch. 5',
      notes: ['shared memory is banked in 32 lanes', 'stride-1 access avoids conflicts', 'pad to break alignment'],
    },
    {
      kind: 'commit', time: '− 1d', repo: 'kernel-notes',
      message: 'docs: tile-quilt diagrams',
      meta: '+118 − 9', hash: '8ab21d4',
      branch: 'main', author: 'molamaker', issue: '#41',
      files: [
        { path: 'docs/tile-quilt.md',  plus: 84,  minus: 0 },
        { path: 'docs/figures/q1.svg', plus: 34,  minus: 9 },
      ],
      diff: '+ ![tile-quilt diagram](figures/q1.svg)\n+\n+ Each warp fetches a 32×4 tile; we offset by 4 rows to avoid\n+ bank conflicts on the second half of the load.',
    },
    {
      kind: 'post', time: '− 18d',
      title: 'I rewrote a CUDA kernel six times',
      slug: 'kernel-rewrite',
      meta: '14 min read', words: 2640,
      tag: 'cuda',
      excerpt: 'Bank conflicts, occupancy, and the small joys of finally seeing SM utilization climb past 80%.',
      toc: ['The first naive version', 'Six rewrites later', 'Profiling, not guessing', 'What stuck'],
      reactions: { heart: 91, brain: 38, fire: 22 },
    },
    {
      kind: 'guestbook', time: '− 3h',
      name: 'Aki', message: 'Stayed for the typography.',
      country: 'JP', accent: '#5E6B8C',
    },
    {
      kind: 'deploy', time: '− 2h',
      env: 'prod', status: 'ok', version: '0.4.1',
    },
    {
      kind: 'note', time: '− 5h',
      text: 'GPU kernel experiments — memory bandwidth saturated at 94%',
    },
  ] as Signal[],

  atlas_subtrees: {
    open: [
      { id: 'astrbot-plugins', label: 'astrbot-plugins', meta: '★ 412' },
      { id: 'kernel-notes',    label: 'kernel-notes',    meta: '★ 287' },
      { id: 'gstack',          label: 'gstack',          meta: '★ 96'  },
      { id: 'omc',             label: 'omc',             meta: '★ 54'  },
    ],
    writing: [
      { id: 'p1', label: 'agent-orchestration', meta: '9m' },
      { id: 'p2', label: 'kernel-rewrite',      meta: '14m' },
      { id: 'p3', label: 'astrbot-plugin-design', meta: '7m' },
      { id: 'p4', label: 'rotational-dynamics', meta: '6m' },
    ],
    work: [
      { id: 'w1', label: 'astrbot suite',  meta: 'ts' },
      { id: 'w2', label: 'kernel-notes',   meta: 'cu' },
      { id: 'w3', label: 'gstack',         meta: 'rs' },
      { id: 'w4', label: 'omc',            meta: 'ml' },
    ],
    now: [
      { id: 'n1', label: 'tea: jasmine', meta: '· hot' },
      { id: 'n2', label: 'desk: jinlin',  meta: '· 23°' },
      { id: 'n3', label: 'mood: cautious', meta: '· soft' },
    ],
    chat: [
      { id: 'c1', label: 'cuda shared memory', meta: '12 t' },
      { id: 'c2', label: "this week's ship", meta: '6 t' },
      { id: 'c3', label: 'serif for code', meta: '4 t' },
    ],
    guest: [
      { id: 'g1', label: 'ren · TW',  meta: '14m' },
      { id: 'g2', label: 'aki · JP',  meta: '3h' },
      { id: 'g3', label: 'haruka',    meta: '1d' },
      { id: 'g4', label: 'wen',       meta: '2d' },
    ],
  } satisfies Record<string, AtlasSubNode[]>,

  zones: [
    { id: 'writing', label: 'Writing', x: 22, y: 26, count: 24, hint: 'long-form notes' },
    { id: 'work',    label: 'Work',    x: 70, y: 18, count: 11, hint: 'shipped projects' },
    { id: 'open',    label: 'Open source', x: 78, y: 56, count: 8, hint: 'repos on GitHub' },
    { id: 'now',     label: 'Now',     x: 50, y: 60, count: 1,  hint: 'this week' },
    { id: 'chat',    label: 'Talk',    x: 18, y: 64, count: '∞', hint: 'with the bot' },
    { id: 'guest',   label: 'Guests',  x: 42, y: 80, count: 312, hint: 'leave a trace' },
  ] as Zone[],

  i18n: {
    en: {
      nav: ['about', 'work', 'writing', 'open', 'now', 'talk', 'guests'],
      eyebrow: 'Portfolio & Journal · Est. 2026',
      h1: ['Building at the', 'edge', 'of systems', 'and intelligence.'],
      lead: "I'm a developer working across CUDA, AI tooling, and the messy seams where they meet.\nCurrently learning to write fast GPU kernels and reasoning about agentic systems.\nThis is where I keep notes.",
      visitor: 'visitor', learning: 'learning', based: 'based', now: 'right now',
      writing: 'Recent writing', work: 'Selected work', open: 'Open source', guests: 'Guestbook',
      reply: 'Sign the guestbook', readAll: 'Read everything',
      hello: 'Hello, world.',
    },
    zh: {
      nav: ['关于', '作品', '文章', '开源', '近况', '聊天', '留言'],
      eyebrow: '个人文集 · 自 2026',
      h1: ['在系统与', '智能', '交界处', '构筑。'],
      lead: '一个在 CUDA、AI 工具链与二者交锈处工作的开发者。最近在学习编写 GPU 内核、思考智能体系统。这里是我记笔记的地方。',
      visitor: '访客', learning: '正在学习', based: '位于', now: '此刻',
      writing: '近期文章', work: '精选作品', open: '开源项目', guests: '留言簿',
      reply: '留下笔迹', readAll: '查看全部',
      hello: '你好，世界。',
    },
  } as Record<Locale, I18nBlock>,

  avatarUrl: 'https://avatars.githubusercontent.com/u/229602071?v=4',
};

export type MolaData = typeof molaData;
