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

