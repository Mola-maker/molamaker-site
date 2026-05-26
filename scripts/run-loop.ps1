# run-loop.ps1 — Launch an autonomous Claude loop for molamaker-site
# Usage:
#   .\scripts\run-loop.ps1 feature "add dark mode toggle to nav"
#   .\scripts\run-loop.ps1 db     "add notifications table with RLS"
#   .\scripts\run-loop.ps1 ci

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("feature", "db", "ci")]
    [string]$Loop,

    [string]$Task = ""
)

$ProjectDir = $PSScriptRoot | Split-Path

Set-Location $ProjectDir

switch ($Loop) {
    "feature" {
        if (-not $Task) { Write-Error "Usage: run-loop.ps1 feature '<task description>'"; exit 1 }

        # Seed SHARED_TASK_NOTES.md with the task
        $date = Get-Date -Format "yyyy-MM-dd HH:mm"
        $notes = @"
# Shared Task Notes

## Current Task
$Task

## Status
IN_PROGRESS

## Started
$date

## Iterations
"@
        Set-Content -Path "SHARED_TASK_NOTES.md" -Value $notes

        Write-Host "Starting feature loop: $Task" -ForegroundColor Cyan
        Write-Host "Loop will run until it outputs FEATURE_LOOP_COMPLETE or hits a blocker." -ForegroundColor Gray
        Write-Host ""

        # Run claude -p in a loop, max 8 iterations
        $maxIter = 8
        for ($i = 1; $i -le $maxIter; $i++) {
            Write-Host "--- Iteration $i / $maxIter ---" -ForegroundColor Yellow

            $prompt = @"
Read SHARED_TASK_NOTES.md first. You are on iteration $i of the feature loop.
Task: $Task

Follow the instructions in .claude/commands/feature-loop.md exactly.
If the feature is complete and all checks pass, output FEATURE_LOOP_COMPLETE.
"@

            $result = $prompt | claude -p --allowedTools "Read,Write,Edit,Bash,Grep,Glob"

            Write-Host $result

            if ($result -match "FEATURE_LOOP_COMPLETE") {
                Write-Host ""
                Write-Host "Feature loop complete after $i iteration(s)." -ForegroundColor Green
                break
            }

            if ($i -eq $maxIter) {
                Write-Host "Max iterations reached. Review SHARED_TASK_NOTES.md for status." -ForegroundColor Red
            }
        }
    }

    "db" {
        if (-not $Task) { Write-Error "Usage: run-loop.ps1 db '<schema change description>'"; exit 1 }

        Write-Host "Starting DB migration loop: $Task" -ForegroundColor Cyan

        $prompt = @"
Task: $Task
Follow the instructions in .claude/commands/db-migration-loop.md exactly.
Output DB_MIGRATION_LOOP_COMPLETE when done.
"@

        $prompt | claude -p --allowedTools "Read,Write,Edit,Bash,Grep,Glob"
    }

    "ci" {
        Write-Host "Starting CI fix loop..." -ForegroundColor Cyan
        Write-Host "Will iterate until lint + tsc + build + tests all pass." -ForegroundColor Gray

        $maxIter = 5
        for ($i = 1; $i -le $maxIter; $i++) {
            Write-Host "--- CI Fix Pass $i / $maxIter ---" -ForegroundColor Yellow

            $prompt = "Follow .claude/commands/ci-fix-loop.md. Fix all CI failures. Output CI_FIX_LOOP_COMPLETE when all checks pass."
            $result = $prompt | claude -p --allowedTools "Read,Write,Edit,Bash,Grep,Glob"

            Write-Host $result

            if ($result -match "CI_FIX_LOOP_COMPLETE") {
                Write-Host ""
                Write-Host "CI fix loop complete after $i pass(es)." -ForegroundColor Green
                break
            }

            if ($i -eq $maxIter) {
                Write-Host "Max passes reached. Manual review needed." -ForegroundColor Red
            }
        }
    }
}
