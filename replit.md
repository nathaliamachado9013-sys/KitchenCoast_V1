# KitchenCost

## Overview

Restaurant cost management SaaS built on Firebase (Auth, Firestore, Hosting, App Check, Gemini AI) + Cloudinary for file storage. pnpm workspace monorepo.

## Stack

- **Monorepo**: pnpm workspaces
- **Frontend**: React 18 + Vite, Tailwind CSS, shadcn/ui
- **Backend**: Firebase (Firestore, Auth, Hosting) + Express API server (port 8080)
- **AI**: Google Gemini via Firebase AI (invoice extraction)
- **Storage**: Cloudinary (invoice images/PDFs, folder `restaurants/{tenantId}/invoices/{invoiceId}`)
- **Node.js**: 24

## Structure

```
artifacts/
  kitchencost/       # React + Vite frontend (deployed to Firebase Hosting)
  api-server/        # Express server for Cloudinary admin operations
```

## Firebase Config

- Project: `kitchencost-e1a2e`
- App Check debug token: `0271b3e6-775e-4420-bbde-47c6e4140beb`
- API Key: `AIzaSyAdhjGfWZmHIvYkeqBt21f7lOB32Iqxjd4`

## Cloudinary Config

- Cloud name: `djq3q2xat`
- Unsigned preset: `kitchencost_invoices`
- Folder pattern: `restaurants/${restaurantId}/invoices/${invoiceId}`
- Deletion endpoint: `DELETE /api/cloudinary/tenant/:tenantId` on API server (port 8080)
- Dev proxy: Vite proxies `/internal-api` → `http://localhost:8080`

## Build & Deploy

```bash
# Build frontend
cd artifacts/kitchencost && PORT=3000 BASE_PATH=/ pnpm run build
# Deploy hosting
firebase deploy --only hosting --project kitchencost-e1a2e
# Deploy Firestore rules
firebase deploy --only firestore:rules
```

## Core System Model

The chain: **Supplier → Invoice → Item → Stock → Cost → Recipe → Price → Sale → Profit**

### Data Integrity Rules

1. **Invoice import is atomic** — all-or-nothing via Firestore `WriteBatch`
2. **Items always enter stock** — no item created without a corresponding stock movement
3. **Supplier totals updated atomically** — `totalSpent`, `invoiceCount`, `lastInvoiceDate` in same batch as invoice import
4. **Stock movements are the single source of truth** — every stock change creates a movement with standard fields: `itemId`, `itemType`, `itemName`, `quantity`, `unit`, `unitCost`, `totalValue`, `referenceType`, `referenceId`, `restaurantId`
5. **Sales freeze cost at time of sale** — `costAtSale`, `salePriceAtSale`, `profitAtSale` stored permanently
6. **Failed invoices never stay stuck** — `status: 'failed'` written on batch commit failure or any mid-import error
7. **Unit normalization enforced** — official units: `g`, `ml`, `L`, `Kg`, `uni`; AI-extracted units normalized via `normalizeUnit()` before storage
8. **Weighted average cost** — computed on every stock entry, stored as `averageCost` on ingredient/product
9. **Recipe cost is dynamic** — RecipesPage computes cost live from current `averageCost` of ingredients
10. **Menu shows ideal vs actual price** — `idealPrice` from recipe's `sellingPrice`, `salePrice` user-defined; "Usar preço sugerido" button available

### Collections

- `restaurants/{id}` — tenant document
- `restaurants/{id}/ingredients` — ingredient catalog
- `restaurants/{id}/resale_products` — resale product catalog
- `restaurants/{id}/suppliers` — supplier catalog (with `totalSpent`, `invoiceCount`, `lastInvoiceDate`)
- `restaurants/{id}/invoices` — purchase invoice headers
- `restaurants/{id}/purchase_lines` — invoice line items
- `restaurants/{id}/stock_movements` — audit trail of all stock changes
- `restaurants/{id}/recipes` — recipe (ficha técnica) with `sellingPrice`, `desiredMargin`
- `restaurants/{id}/menu_items` — cardápio items with `salePrice` (actual) linked to recipe
- `restaurants/{id}/sales` — sales records with frozen cost/profit snapshots
- `restaurants/{id}/productions` — production records
- `restaurants/{id}/users/{uid}` — user documents

### Invoice Statuses

`draft` → `in_review` → `imported` | `with_divergence` | `failed` | `cancelled`

### Key Files

- `artifacts/kitchencost/src/lib/firestore.js` — all Firestore operations
- `artifacts/kitchencost/src/lib/utils.js` — utilities including `normalizeUnit()`, `ALLOWED_UNITS`, `convertUnits()`
- `artifacts/kitchencost/src/pages/PurchasesPage.jsx` — invoice import flow (upload → AI extract → review → atomic import)
- `artifacts/kitchencost/src/pages/MenuPage.jsx` — cardápio with ideal vs actual price
- `artifacts/kitchencost/src/pages/RecipesPage.jsx` — ficha técnica with dynamic cost
- `artifacts/kitchencost/src/pages/SuppliersPage.jsx` — supplier management with invoice history
- `artifacts/kitchencost/src/pages/StockPage.jsx` — inventory with stock movements
- `artifacts/kitchencost/src/pages/SettingsPage.jsx` — account settings and deletion
- `artifacts/kitchencost/src/contexts/AuthContext.jsx` — auth + tenant context
- `artifacts/api-server/src/routes/cloudinary.ts` — Cloudinary tenant deletion endpoint
- `artifacts/kitchencost/firestore.rules` — security rules

## GitHub

Remote: `https://github.com/nathaliamachado9013-sys/KitchenCoast_V1.git` branch `master`
