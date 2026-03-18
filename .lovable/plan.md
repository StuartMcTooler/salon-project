

# Fix Build Errors

## Problem
The build is failing with two issues:
1. **`Cannot find package 'rollup'`** — Vite cannot resolve its `rollup` dependency. This was caused by a `bun.lock` file created in a prior session that conflicts with the existing `package-lock.json` and the build system's module resolution.
2. **TypeScript errors in recharts components** — These are pre-existing type compatibility issues between `recharts` and React 18 strict JSX types. They don't affect runtime but block `tsc`.

## Fix

### Step 1: Remove `bun.lock`
Delete the `bun.lock` file. The project uses npm (`package-lock.json`), and a conflicting bun lockfile causes module resolution failures.

### Step 2: No code changes needed
- The `QueryClient` import in `App.tsx` is correct — `@tanstack/react-query` exports it
- The recharts TS errors are suppressed at build time by `skipLibCheck: true`
- The `rollup` error is purely a dependency resolution conflict from the lockfile

