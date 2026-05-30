# Diplov Upstream Sync Guide

This fork tracks the upstream project at `crynta/terax-ai` while keeping a few local changes that make Terax work the way Diplov wants.

## Current remote layout

- `origin` = `https://github.com/crynta/terax-ai`
- `fork` = `https://github.com/Diplovee/terax-ai.git`

## Current local-only commits

At the time this guide was written, the fork carries these custom commits on top of upstream:

- `f9e5182` `Fix Terax dev startup`
- `e3d5925` `Restore Bun-based dev startup`
- `39fc852` `Prevent concurrent dev sessions from killing Vite`

If upstream eventually absorbs these changes, drop the duplicates instead of keeping parallel versions.

## Normal update flow

Run this from `/home/tk/terax-ai`.

```bash
git fetch origin
git fetch fork
git checkout main
git rebase origin/main
git push fork main
```

This works when your local commits already replay cleanly on top of the latest upstream.

## Safe update flow when you have local edits

If `git status --short` shows work in progress, stash it first:

```bash
git stash push -u -m "pre-upstream-sync"
git fetch origin
git checkout main
git rebase origin/main
git stash pop
```

If `git stash pop` causes conflicts, resolve them, then continue working and commit normally.

## If rebase conflicts

Most likely conflict areas for this fork are:

- `package.json`
- `src-tauri/tauri.conf.json`
- `scripts/dev.mjs`
- `README.md`
- `vite.config.ts`

When that happens:

1. Keep upstream feature work unless it breaks the local startup flow.
2. Preserve the Bun-based local workflow:
   - `package.json`: `dev` should stay `node scripts/dev.mjs`
   - `package.json`: `dev:web` should stay `vite`
   - `src-tauri/tauri.conf.json`: `beforeDevCommand` should stay `bun run dev:web`
3. Preserve the single-instance lock in `scripts/dev.mjs` so a second `bun run dev` does not kill the first one.
4. Re-test with `bun run dev`.

## If the branch gets messy

If you want to rebuild the fork cleanly from upstream while keeping the local behavior:

```bash
git fetch origin
git checkout main
git reset --hard origin/main
git cherry-pick f9e5182 e3d5925 39fc852
git push --force-with-lease fork main
```

Only use this reset path when you are sure there is no uncommitted work to keep.

## Checks after syncing

Run these after an upstream update:

```bash
bun install
bun run dev
```

Things to verify:

- Terax starts from the repo without `dev:web exited with code 143`
- opening a second launcher does not kill the first dev session
- the menu launcher still works through `~/.local/bin/terax`

## Desktop launcher note

The current desktop launcher does not use the AppImage. It runs:

```bash
/home/tk/.local/bin/terax
```

That wrapper changes into `/home/tk/terax-ai` and runs:

```bash
bun run dev
```

If the launcher stops working after an update, check the wrapper first.
