import { describe, it, expect } from 'vitest';
import { guestbookSchema, contactSchema } from '@/lib/validation';

describe('guestbookSchema', () => {
  it('accepts valid input', () => {
    const result = guestbookSchema.safeParse({
      name: 'Alice',
      message: 'Hello, this is a test message!',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = guestbookSchema.safeParse({
      name: '',
      message: 'Hello!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('required');
    }
  });

  it('rejects empty message', () => {
    const result = guestbookSchema.safeParse({
      name: 'Alice',
      message: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('required');
    }
  });

  it('rejects message exceeding 240 characters', () => {
    const result = guestbookSchema.safeParse({
      name: 'Alice',
      message: 'x'.repeat(241),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('240');
    }
  });

  it('rejects name exceeding 40 characters', () => {
    const result = guestbookSchema.safeParse({
      name: 'x'.repeat(41),
      message: 'Hello!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('40');
    }
  });

  it('sanitizes HTML in name', () => {
    const result = guestbookSchema.safeParse({
      name: '<script>alert("xss")</script>',
      message: 'Hello!',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).not.toContain('<script>');
      expect(result.data.name).toContain('&lt;script&gt;');
    }
  });

  it('sanitizes HTML in message', () => {
    const result = guestbookSchema.safeParse({
      name: 'Alice',
      message: '<b>bold</b>',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).not.toContain('<b>');
      expect(result.data.message).toContain('&lt;b&gt;');
    }
  });

  it('accepts message at exactly 240 characters', () => {
    const result = guestbookSchema.safeParse({
      name: 'Alice',
      message: 'x'.repeat(240),
    });
    expect(result.success).toBe(true);
  });
});

describe('contactSchema', () => {
  it('accepts valid input with all fields', () => {
    const result = contactSchema.safeParse({
      name: 'Bob',
      email: 'bob@example.com',
      subject: 'Question',
      message: 'I have a question about your work.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty name (optional)', () => {
    const result = contactSchema.safeParse({
      name: '',
      email: 'bob@example.com',
      subject: 'Question',
      message: 'Hello there.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty email (optional)', () => {
    const result = contactSchema.safeParse({
      name: 'Bob',
      email: '',
      subject: 'Question',
      message: 'Hello there.',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBeNull();
    }
  });

  it('rejects invalid email', () => {
    const result = contactSchema.safeParse({
      name: 'Bob',
      email: 'not-an-email',
      subject: 'Question',
      message: 'Hello.',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('Invalid email');
    }
  });

  it('rejects empty message', () => {
    const result = contactSchema.safeParse({
      name: 'Bob',
      email: 'bob@example.com',
      subject: 'Question',
      message: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('required');
    }
  });

  it('rejects message exceeding 5000 characters', () => {
    const result = contactSchema.safeParse({
      name: 'Bob',
      email: 'bob@example.com',
      subject: 'Question',
      message: 'x'.repeat(5001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('5000');
    }
  });

  it('rejects name exceeding 80 characters', () => {
    const result = contactSchema.safeParse({
      name: 'x'.repeat(81),
      email: 'bob@example.com',
      subject: 'Q',
      message: 'Hello.',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('80');
    }
  });

  it('sanitizes HTML in message', () => {
    const result = contactSchema.safeParse({
      name: 'Bob',
      email: 'bob@example.com',
      subject: 'Question',
      message: '<script>alert(1)</script>',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).not.toContain('<script>');
      expect(result.data.message).toContain('&lt;script&gt;');
    }
  });
});
