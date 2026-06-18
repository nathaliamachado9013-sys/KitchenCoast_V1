---
name: run-kitchencost
description: run, build, and test the KitchenCoast web app using Vite + React
---

# KitchenCoast Web App

KitchenCoast is a React + TypeScript web app for restaurant inventory and production management. It runs on Vite with Firebase backend. This skill describes how to build and launch the dev server on your local machine.

**Paths in this skill are relative to `artifacts/kitchencost/`.** All commands run from there unless stated otherwise.

## Prerequisites

Node.js 18+ and pnpm package manager.

**Windows:** Install Node.js via `winget install OpenJS.NodeJS --source winget`, then install pnpm:
```bash
npm install -g pnpm
```

**macOS:** Use Homebrew:
```bash
brew install node
npm install -g pnpm
```

**Linux:** Use your package manager (e.g., Ubuntu):
```bash
sudo apt-get install nodejs npm
npm install -g pnpm
```

Verify installation:
```bash
node --version  # v18.0.0 or higher
npm --version   # 9.0.0 or higher
pnpm --version  # 8.0.0 or higher
```

## Build

From the repository root (`artifacts/kitchencost/`):

1. **Install dependencies** (first time only, ~5-10 min):
   ```bash
   pnpm install
   ```
   This installs all packages for the monorepo. Ignore warnings about peer dependencies and ignored build scripts — these are harmless.

2. **Configure environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and fill in Firebase credentials. Without valid credentials, the app loads but shows a blank page (see Gotchas).

3. **Type check** (optional, catches TypeScript errors):
   ```bash
   pnpm --filter @workspace/kitchencost run typecheck
   ```

4. **Production build** (optional, creates `dist/` folder):
   ```bash
   pnpm --filter @workspace/kitchencost run build
   ```

## Run (Agent Path)

Start the Vite dev server:

```bash
export PATH="/c/Program Files/nodejs:$PATH"  # Windows/Git Bash only
cd artifacts/kitchencost
npm run dev
```

**Expected output** (server is ready when you see):
```
VITE v7.3.1  ready in 966 ms

➜  Local:   http://localhost:5173/
➜  Network: http://192.168.10.131:5173/
```

**Driver:** The dev server runs in the foreground. To test it programmatically:

```bash
# Verify server is responding (from another terminal)
curl http://localhost:5173/
```

**Dashboard** — to see what's running:
- Open `http://localhost:5173/` in a browser
- You should see the KitchenCoast login page (with Firebase configured)
- Login with test Firebase account and navigate to Dashboard
- Create test data via Ingredientes → Compras → Receitas → Produção → Vendas

## Run (Human Path)

From the repo root:

```bash
cd artifacts/kitchencost
npm run dev
```

Then open **http://localhost:5173** in your browser. Press Ctrl-C to stop the server.

## Gotchas

### Firebase Credentials Required
The app uses Firebase for all data. Without a valid `.env.local` file with Firebase config, the app loads a blank white page (HTML and CSS load, but React crashes silently on auth checks).

**Fix:** Copy `.env.example` → `.env.local` and fill in your Firebase project details. Then restart the dev server.

### Node.js Not in PATH (Windows)
After installing Node.js, PowerShell may not recognize `node` or `npm` commands until you restart PowerShell or manually add the path.

**Fix:** Use the full path or add Node.js bin to PATH:
```bash
export PATH="/c/Program Files/nodejs:$PATH"  # Git Bash
# OR restart PowerShell after installation
```

### Pnpm Lock File Errors
If you see "pnpm: command not found" after installing globally, Node.js isn't in the current shell's PATH.

**Fix:** Restart your terminal or use `npm run dev` directly (which bypasses pnpm).

### Port 5173 Already in Use
If another app is using port 5173, Vite will fail to start.

**Fix:** Kill the existing process or use a different port:
```bash
npm run dev -- --port 5174
```

### Blank Page After Login
If you login but see a blank dashboard, check the browser's developer console (F12 → Console tab) for errors. Common causes:
- Firebase authentication failed (invalid credentials)
- Missing .env.local file
- Firestore rules deny read access

**Fix:** Verify .env.local is present and Firebase credentials are valid.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `pnpm: command not found` | Install pnpm: `npm install -g pnpm` |
| `Cannot find module '@workspace/...'` | Run `pnpm install` from repo root |
| `Error: EACCES: permission denied` (macOS/Linux) | Use `sudo npm install -g pnpm` or install Node via nvm |
| Vite fails to start on Windows | Restart PowerShell or add Node to PATH |
| `VITE ERR_CLOSED_BEFORE_RESOLVE` | Another process is using port 5173; use `--port` flag |
| Blank white page after login | Missing `.env.local` or invalid Firebase credentials |
| `Firebase: Error (auth/network-request-failed)` | Check internet connection or Firebase credentials |

## Test

Run the type-checking test suite:

```bash
pnpm --filter @workspace/kitchencost run typecheck
```

This verifies TypeScript code is correct (no type errors). The dev server also shows TypeScript errors in the terminal output as you edit files (HMR).

For end-to-end testing, see `artifacts/kitchencost/src/pages/` to understand the main app flows:
- **Dashboard.tsx** — summary of today's production/sales
- **RecipesPage.tsx** — create/edit recipes with ingredients and costs
- **ProductionPage.tsx** — register production batches
- **StockPage.tsx** — manage ingredient inventory
- **PurchasesPage.tsx** — import purchase orders and update costs
- **MenuPage.tsx** — create menu items (recipes + price)
- **SalesPage.tsx** — record sales transactions
- **ResaleProductsPage.tsx** — manage resale products (beverages)
