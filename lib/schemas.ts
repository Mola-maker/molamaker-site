// These schemas mirror the DB structure.
// lib/validation.ts handles form-level validation with sanitization.

import { z } from 'zod';

export const PostSchema = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(200),
  excerpt: z.string().max(500).nullable().optional(),
  content: z.string(),
  read_time: z.number().int().min(1).max(120),
  published: z.boolean().default(false),
  view_count: z.number().int().min(0).default(0),
});

export const GuestbookEntrySchema = z.object({
  name: z.string().trim().min(1).max(40),
  message: z.string().trim().min(1).max(240),
});

export const ContactMessageSchema = z.object({
  name: z.string().max(80).optional().default(''),
  email: z.string().email().max(200).optional().or(z.literal('')),
  subject: z.string().max(200).optional().default(''),
  message: z.string().trim().min(1).max(5000),
});
