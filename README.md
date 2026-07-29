# TangLak (ตั้งหลัก) — Mobile

Ionic React + Capacitor personal-finance app for the Thai market: slip OCR expense tracking, debt payoff planning, and budget/overview reporting. Mobile port of the Next.js web app at `../tanglak`, sharing the same Supabase backend. App id `com.tanglak.mobile`.

## Stack

- **Framework**: Ionic React 8 + Vite + TypeScript, React Router v5 (`IonReactRouter`)
- **State**: No global data store — page data is fetched per-view via `useIonViewData` (see below), no client-side cache. Zustand is used only for the two small pieces of state that genuinely need cross-component sync (`privacyStore.ts`, `notificationPrefs.ts`), both localStorage-backed.
- **Backend**: Supabase (`@supabase/supabase-js`, client-side, RLS-scoped anon key — no service-role key anywhere in this repo)
- **AI**: Google Gemini Vision, called only from Supabase Edge Functions (never directly from the client)
- **Native**: Capacitor 8 — `@capacitor/app`, `@capacitor/browser`, `@capacitor/haptics`, `@capacitor/keyboard`, `@capacitor/local-notifications`, `@capacitor/status-bar`, `@aparajita/capacitor-biometric-auth`
- **Tests**: Vitest unit/component/Edge-contract tests plus Playwright mobile-browser E2E. Supabase calls are mocked in automated tests; no production data is used.
- **Android only** for now; iOS not started

## Setup

```
npm install
cp .env.example .env.local         # fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev                         # Vite dev server, port 5190 (5173 collides with a sibling project)
```

Android platform is already added (`android/`). After any web change destined for a device:

```
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

`npx cap sync` is reliably blocked by this environment's agent-safety classifier when run by an AI assistant here — if you're an agent working in this repo and it gets blocked, ask the user to run it rather than trying workarounds.

## Conventions (read before touching date/money code)

- **Bangkok time is a fixed UTC+7 offset app-wide, no DST** (`src/lib/bangkokDate.ts`, `src/lib/date.ts`). Never use device-local time for "today" or "this month" — Supabase `timestamptz` columns are UTC; always convert via `isoInstantToBangkokDatetimeLocal` or the `bangkokMonthRange`/`todayBangkokRange` helpers, never by string-slicing an ISO timestamp.
- **Gregorian year everywhere**, never Buddhist era — enforced via `-u-ca-gregory` locale override in every `Intl.DateTimeFormat` call. This is a locked convention; the web app under `../tanglak` still shows Buddhist-era dates in places, mobile deliberately does not.
- **Money is always integer satang** (1/100 THB) in code and in the DB (`amount_satang` etc.), formatted for display only at the last moment via `formatTHB` (`src/lib/money.ts`). Never do arithmetic on baht floats.
- **No silent financial state transitions.** Debt cycle rollover, transaction edits, and reconciliation are always explicit, user-triggered actions with a confirm step — never automatic/background, except the one narrow case in `shouldAutoAdvance()` (`src/lib/debts.ts`) which only auto-advances a debt cycle that is both fully paid AND past its due date (never hides money still owed).
- **Never fabricate a default for missing financial data.** If income/date/amount is unknown, surface that as a zero/empty state to the user — don't fall back to a plausible-looking hardcoded number (a real bug fixed this way once already: `dailySpendLimit.ts` used to default to a hardcoded ฿30,000/month).

## Architecture

```
src/
  App.tsx              session-gated router; wraps everything in BiometricLockGuard + PrivacyBlurOverlay
  components/          shared UI (see Components below)
  pages/                one file per route (see Routes below)
  lib/                  pure logic + Supabase calls, no React
  theme/variables.css   --tl-* design tokens + Ionic fill="outline" theming
supabase/functions/     Deno Edge Functions (see Edge Functions below)
android/                Capacitor Android platform
scripts/                release build/sign/distribute PowerShell scripts
```

### Routes (`src/App.tsx`)

| Path | Page | Notes |
|---|---|---|
| `/login` | `LoginPage` | email/password + Google OAuth using PKCE (exact deep-link callback `tanglak://login-callback`; the redirect URL must be registered in the Supabase Auth dashboard) |
| `/tabs/*` | `MainTabs` → Today / Transactions / Upload / Debts / More | 5-tab bar, the main app shell |
| `/overview` | `OverviewPage` | month cash-remaining, category donut, 4-month cash-flow trend, financial health score |
| `/budget`, `/budget/edit` | `BudgetPage`, `BudgetEditPage` | monthly income + category budgets |
| `/settings` | `SettingsPage` | biometric lock toggle, debt-reminder toggle, sign out |
| `/accounts` | `AccountsPage` | read-only account list |
| `/transactions/:id/edit` | `EditTransactionPage` | shared review-form pattern with Upload |
| `/debts/new`, `/debts/:id/edit` | `DebtFormPage` | full debt CRUD, cycle-advance action |
| `/debts/:id/simulate` | `DebtSimulatePage` | single-debt payoff what-if (never writes) |
| `/debts/strategy` | `DebtStrategyPage` | avalanche vs. snowball multi-debt comparison |

### Edge Functions (`supabase/functions/`, Deno, shared `tanglak` Supabase project)

All financial writes go through these — the client never writes to `transactions`/`debts` write-paths directly except budget and debt CRUD, which rely on Postgres CHECK constraints + RLS as the backstop instead of a function.

- **`extract-document`** — Gemini Vision OCR on an uploaded slip/statement image. Returns normalized JSON, never invents a date (a missing/unparseable date is surfaced as missing, never defaulted to "now").
- **`save-transaction`** — validates + inserts/updates `income`/`expense`/`transfer`/`refund` rows. Always re-validates amount/date server-side regardless of what the client sends.
- **`add-debt-payment`** — 3-part write (transaction row + `debt_payments` row + from-scratch recalculation of the debt's current-cycle paid amount). Never increments in place. If a later step fails, the function compensates by removing earlier writes and recalculating again.
- **`delete-transaction`** — deletes the linked `debt_payments` row before its transaction and recalculates the affected debt. If deletion or recalculation fails, it restores captured rows before returning an error.
- **`_shared/debtCycle.ts`** — the cycle-window recalculation logic, shared between `add-debt-payment` and `delete-transaction`.
- **`_shared/compensatingWrites.ts`** — testable failure/rollback orchestration for the two multi-step write paths above. This closes normal request-failure paths but is not a substitute for a PostgreSQL transaction if the Edge Function process is terminated between network calls; a true atomic guarantee requires a shared-backend RPC/migration outside this repository.

### Key `lib/` modules

- `money.ts`, `date.ts`, `bangkokDate.ts` — the conventions above, in code. Fully unit tested.
- `transactions.ts`, `debts.ts`, `budget.ts`, `accounts.ts`, `overview.ts` — Supabase reads/writes via the user's own RLS-scoped client.
- `debtSimulator.ts` — single-debt amortization projection (ported from the web app's live `/debts/[id]/simulate`).
- `debtPortfolioStrategy.ts` — multi-debt avalanche/snowball comparison (ported from a web-app branch that was built but never shipped there).
- `dailySpendLimit.ts` — `(plannedIncome − debtMinimums − monthSpentBeforeToday) / daysRemainingInMonth`, sourced from `getOverviewSnapshot()`, no fabricated defaults.
- `biometrics.ts` — wraps `@aparajita/capacitor-biometric-auth`; real native OS prompt with device PIN/pattern fallback, fails open only if the device has neither biometry nor any lock at all.
- `notifications.ts` + `notificationPrefs.ts` — local push reminders 3 days and 1 day before a debt's due date; the toggle in Settings persists to localStorage and is actually respected (doesn't just reset on next load).
- `privacyStore.ts` — app-wide "mask all amounts" toggle (Zustand store, localStorage-backed) + auto-blur on app-switcher/background.
- `useIonViewData.ts` — shared load/error/spinner hook used by most read-only pages; not used by pages with multi-step or multi-source loading shapes (see the hook's own doc comment).
- `financialHealthScore.ts` — 0–100 score / A+–D grade from DTI ratio, surplus rate, active debt risk.
- `merchantRules.ts` — learns merchant→category associations on save/edit, pre-seeded with common Thai merchants.
- `documentUpload.ts` — image resize/compress + Edge Function invocation; also handles NCB credit-bureau PDF / e-statement import for debts.

### Key `components/`

- `BiometricLockGuard` — full-screen lock shown on cold start / resume when the biometric toggle is on.
- `PrivacyBlurOverlay` — blurs the screen when the app is backgrounded or in the app switcher.
- `DateField` / `DateTimeField` — shared custom date pickers styled to match native `IonInput` (`fill="outline"` tokens), used everywhere instead of a native date input.
- `TransactionList` / `TransactionRow` — day-grouped transaction list with edit/delete action sheet.
- `DebtCard`, `DebtFreedomWidget`, `DebtImportModal` — debt list card, payoff-date widget, NCB import flow.
- `CategoryDonutChart`, `CashFlowBarChart`, `FinancialHealthCard`, `DailySpendCard` — Overview/Today reporting widgets.

## Testing & release

```
npm run test.unit -- --run     # vitest, 186 tests
npm run test:e2e               # Playwright, Pixel 7 viewport, mocked Supabase network boundary
npx tsc --noEmit                # typecheck
npx eslint .                    # lint (supabase/functions/** excluded — Deno runtime, own lint rules)
npm run build                   # tsc + vite build
```

`scripts/build-android-release.ps1` runs the unit-test suite as a gate before lint/build/`cap sync`/`gradlew`. Release signing (`android/app/tanglak-release.jks` + `android/keystore.properties`, both gitignored) must be set up once via `npm run android:signing:setup` — do not attempt to generate this unattended; it's a hard-to-reverse credential the user should own.

```
npm run android:release:apk     # or :aab, or `android:release` for both
npm run android:distribute      # Firebase App Distribution, shared runmate-mobile Firebase project
```

Firebase App ID: `1:276482893444:android:f506254af133e7cea584d1`.

## Known gaps / caveats (check before assuming something works)

- **No iOS build.** Android only.
- **`extract-document`'s type-classification is prompt-driven, not code-driven.** If a scanned slip lands on the wrong transaction type, check the prompt's reasoning rules first before assuming a client bug.
- **Auto-save (opt-in toggle on Upload) skips the human review step entirely** — a scanned slip's type/amount/category go straight from the AI extraction to the database with no human check. Structural validity (has an amount, has a date) is still enforced; correctness of what the AI guessed is not.
- **Supabase automation is mocked, not live.** Unit tests cover client request/error contracts and Edge compensation failure paths, while Playwright covers auth routing and confirmed transaction deletion at the browser/network boundary. RLS policies and deployed Edge Functions still require a dedicated local-Supabase or staging integration suite.
- **Compensating writes still have a process-crash window.** The mobile Edge Functions undo completed steps when a normal database call fails, but only a PostgreSQL transaction can guarantee atomicity if the function process is terminated between calls. That RPC belongs to the shared backend and is intentionally outside this repository.
- **Android app data is excluded from automatic backup and device transfer.** Session and local privacy/notification preferences should be recreated after reinstall or device migration rather than restored from backup.
- Financial-invariant documentation (14 locked rules — no partial writes, cycle-scoped debt-paid amounts, no fallback timestamps, etc.) lives in the web app at `../tanglak/docs/agent/FINANCIAL_INVARIANTS.md` — this repo doesn't duplicate it, but every write path here should still honor it.

## Multi-session note

This repo is sometimes worked on by more than one agent/session concurrently (the `c:/Project/` parent directory holds 40+ sibling repos across several products, and it has happened that two sessions edited `tanglak-mobile` at the same time without knowing about each other). Before committing, check `git status` against what you actually wrote this session, not just what's sitting in the working tree — a large unexpected diff may belong to someone else's in-progress work.
