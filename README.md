# TangLak (ตั้งหลัก) — Mobile

Ionic React + Capacitor personal-finance app for the Thai market. TangLak Mobile focuses on tracking income and expenses from scanned slips, monthly budgets, and cash-flow reporting. It shares the Supabase backend with the Next.js web app at `../tanglak`. App id: `com.tanglak.mobile`.

## Stack

- Ionic React 8, Vite, TypeScript, React Router v5
- Supabase client with RLS-scoped anon access
- Google Gemini Vision through a Supabase Edge Function
- Capacitor 8 for Android, browser auth, haptics, keyboard, status bar, and biometric lock
- Vitest unit/component tests and Playwright mobile-browser E2E

## Setup

```sh
npm install
cp .env.example .env.local
npm run dev
```

Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`. The Vite dev server uses port 5190.

After a web change destined for a device:

```sh
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

## Product scope

The mobile app supports:

- Today summary with actual income, expenses, and a daily spending limit
- Transaction history, editing, and deletion
- Slip scanning with an explicit review step
- Monthly income and category budgets
- AI-generated budget plans based on monthly category aggregates, with preview and confirmation before any write
- Overview charts for category spending and four-month cash flow
- Account listing, privacy mode, and biometric lock

Debt planning, debt CRUD, payoff simulation, NCB/PDF import, and debt reminders are intentionally not part of the mobile product.

Historical rows whose backend type is `debt_payment` remain readable and deletable for compatibility. The UI treats them as expenses and includes them in expense totals. New lender-payment slips are saved as normal expenses under the `debt` expense category; the mobile app does not create new `debt_payment` rows.

## Important conventions

- Bangkok time is fixed UTC+7 app-wide. Use `bangkokDate.ts` and `date.ts`; do not derive “today” or “this month” from device-local time.
- Use Gregorian years in all displayed dates.
- Keep money as integer satang in code and the database. Convert only at input/output boundaries.
- Never fabricate missing financial data. Unknown income, date, or amount must stay empty or zero and be visible to the user.
- Scanned data is always reviewed before saving; selecting an image never writes a transaction by itself.
- AI budget plans are suggestions. The user chooses categories and confirms the plan before budget rows are created or replaced.

## Routes

| Path | Page |
|---|---|
| `/login` | Email/password and Google PKCE login |
| `/tabs/today` | Today summary |
| `/tabs/transactions` | Transaction history |
| `/tabs/upload` | Slip scan and review |
| `/tabs/more` | More menu |
| `/overview` | Monthly cash-flow overview |
| `/budget`, `/budget/edit` | Monthly and category budgets |
| `/settings` | Account, biometric lock, sign out |
| `/accounts` | Read-only account list |
| `/transactions/:id/edit` | Edit a supported transaction |

## Edge Functions

- `extract-document` — Gemini Vision extraction for slip images
- `suggest-budget` — Gemini budget planning from income and aggregate category totals; merchant and transaction details are not sent
- `save-transaction` — validates and inserts/updates income, expense, transfer, and refund rows
- `delete-transaction` — deletes transactions and retains compatibility cleanup for historical debt-payment rows
- `_shared/debtCycle.ts` and `_shared/compensatingWrites.ts` — legacy cleanup safety used only when deleting historical debt-payment rows

The compatibility delete path is not a product debt-management feature and must not be used to create new debt state.

## Testing

```sh
npm run test.unit -- --run
npm run test:e2e
npx tsc --noEmit
npx eslint .
npm run build
```

Supabase calls are mocked in automated tests; no production data is used. Deployed Edge Functions and RLS policies still require staging or local-Supabase integration verification.

## Android release

```sh
npm run android:signing:setup
npm run android:release:apk
npm run android:release:aab
```

Release credentials are gitignored and must remain user-owned. Android app data is excluded from automatic backup and device transfer.
