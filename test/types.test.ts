import { describe, it, expectTypeOf } from 'vitest';
import type { Post, GuestbookEntry, ContactPayload, PageViewPayload, ApiResult } from '@/lib/types';

describe('types', () => {
  it('Post has required fields', () => {
    expectTypeOf<Post>().toHaveProperty('slug');
    expectTypeOf<Post>().toHaveProperty('title');
    expectTypeOf<Post>().toHaveProperty('published_at');
    expectTypeOf<Post>().toHaveProperty('read_time');
    expectTypeOf<Post>().toHaveProperty('view_count');

    // slug, title, published_at are strings
    expectTypeOf<Post['slug']>().toBeString();
    expectTypeOf<Post['title']>().toBeString();
    expectTypeOf<Post['published_at']>().toBeString();
  });

  it('GuestbookEntry has required fields', () => {
    expectTypeOf<GuestbookEntry>().toHaveProperty('id');
    expectTypeOf<GuestbookEntry>().toHaveProperty('name');
    expectTypeOf<GuestbookEntry>().toHaveProperty('message');
    expectTypeOf<GuestbookEntry>().toHaveProperty('created_at');

    expectTypeOf<GuestbookEntry['id']>().toBeString();
    expectTypeOf<GuestbookEntry['name']>().toBeString();
    expectTypeOf<GuestbookEntry['message']>().toBeString();
  });

  it('ContactPayload has correct field types', () => {
    expectTypeOf<ContactPayload>().toHaveProperty('name');
    expectTypeOf<ContactPayload>().toHaveProperty('email');
    expectTypeOf<ContactPayload>().toHaveProperty('subject');
    expectTypeOf<ContactPayload>().toHaveProperty('message');

    expectTypeOf<ContactPayload['name']>().toBeString();
    // email is nullable — the contact form permits empty email
    expectTypeOf<ContactPayload['email']>().toEqualTypeOf<string | null>();
    expectTypeOf<ContactPayload['subject']>().toBeString();
    expectTypeOf<ContactPayload['message']>().toBeString();
  });

  it('PageViewPayload has path string field', () => {
    expectTypeOf<PageViewPayload>().toHaveProperty('path');
    expectTypeOf<PageViewPayload['path']>().toBeString();
  });

  it('ApiResult is a discriminated union', () => {
    // Ok branch
    type OkResult = Extract<ApiResult, { ok: true }>;
    expectTypeOf<OkResult['ok']>().toEqualTypeOf<true>();

    // Error branch
    type ErrorResult = Extract<ApiResult, { ok: false }>;
    expectTypeOf<ErrorResult['ok']>().toEqualTypeOf<false>();
    expectTypeOf<ErrorResult['error']>().toBeString();
  });
});
