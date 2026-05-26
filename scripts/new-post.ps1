# new-post.ps1 — scaffold a new blog post and optionally push it.
# Usage:
#   .\scripts\new-post.ps1 -Title "My post title"
#   .\scripts\new-post.ps1 -Title "My post" -Push

param(
  [Parameter(Mandatory)]
  [string]$Title,
  [string]$Tag = "writing",
  [switch]$Push
)

$slug = $Title.ToLower() -replace '[^a-z0-9\s-]', '' -replace '\s+', '-' -replace '-+', '-'
$date = (Get-Date).ToString("yyyy-MM-dd")
$file = Join-Path $PSScriptRoot "..\content\$slug.md"

if (Test-Path $file) {
  Write-Error "Post already exists: $file"
  exit 1
}

$content = @"
---
title: $Title
date: $date
excerpt: [FILL IN: one-sentence description]
tag: $tag
read_time: 5
---

Write your post here.

## Section one

Content goes here.

## Section two

More content.
"@

Set-Content -Path $file -Value $content -Encoding UTF8
Write-Host "Created: $file"
Write-Host ""
Write-Host "Edit the file, then push with:"
Write-Host "  git add content/$slug.md && git commit -m 'post: $slug' && git push"

if ($Push) {
  git add "content/$slug.md"
  git commit -m "post: add $slug"
  git push
  Write-Host "Pushed. Vercel will deploy in ~30s."
}
