export type Post = {
  slug: string;
  title: string;
  published_at: string;
  read_time: number;
  view_count: number;
  published?: boolean;
  excerpt?: string | null;
  content?: string | null;
};

export type GuestbookEntry = {
  id: string;
  name: string;
  message: string;
  created_at: string;
};

export type Project = {
  repo: string;
  year: string;
  desc: string;
  tags: string[];
  stars?: number;
};

export type ContactPayload = {
  name: string;
  email: string | null;
  subject: string;
  message: string;
};

export type PageViewPayload = {
  path: string;
};

export type ApiResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };
