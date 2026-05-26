#!/usr/bin/env node
// Validates that every content/*.md file has the required frontmatter fields.

const fs = require('fs');
const path = require('path');

const contentDir = path.join(__dirname, '..', 'content');
const required = ['title', 'date', 'excerpt'];

let errors = 0;

if (!fs.existsSync(contentDir)) {
  console.log('content/ dir not found — skipping.');
  process.exit(0);
}

for (const file of fs.readdirSync(contentDir).filter((f) => f.endsWith('.md'))) {
  const raw = fs.readFileSync(path.join(contentDir, file), 'utf-8');
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    console.error(`✗ ${file}: missing frontmatter block`);
    errors++;
    continue;
  }
  const fm = fmMatch[1];
  for (const field of required) {
    if (!new RegExp(`^${field}:`, 'm').test(fm)) {
      console.error(`✗ ${file}: missing required field "${field}"`);
      errors++;
    }
  }
  if (fmMatch) {
    const slug = file.replace(/\.md$/, '');
    if (/[^a-z0-9-]/.test(slug)) {
      console.error(`✗ ${file}: slug contains invalid characters (use lowercase, digits, hyphens only)`);
      errors++;
    }
  }
}

if (errors === 0) {
  console.log(`✓ All ${fs.readdirSync(contentDir).filter((f) => f.endsWith('.md')).length} posts valid.`);
} else {
  process.exit(1);
}
