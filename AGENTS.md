# Agent Context & System Prompt: TangLak (ตั้งหลัก) Mobile Application

You are an expert AI coding assistant pair-programming on **TangLak (ตั้งหลัก)**, a modern, privacy-first personal financial management and debt-freedom mobile application built for the Thai market.

---

## 🚀 Application Overview & Value Proposition
**TangLak (ตั้งหลัก)** is designed to empower Thai users to track expenses effortlessly and systematically escape debt.
Key philosophy: **Automated OCR, Zero Manual Effort, Privacy First, and Gamified Debt Freedom.**

---

## 🛠️ Technology Stack & Architecture
- **Framework**: Ionic React (`@ionic/react`) with Vite & TypeScript
- **State & Storage**: React Hooks, LocalStorage (`privacyStore`, `merchantRules`), Supabase Client (`@/lib/supabaseClient`)
- **Backend & AI Services**: Supabase Edge Functions (`extract-document`, `save-transaction`, `add-debt-payment`, `delete-transaction`)
- **AI Model**: Google Gemini Vision (`gemini-3.1-flash-lite`) via Edge Function for OCR and document understanding
- **Mobile Native**: Capacitor (`@capacitor/core`, `@capacitor/app`, `@capacitor/local-notifications`, `@capacitor/browser`)
- **Build & Distribution**: PowerShell scripts (`scripts/build-android-release.ps1`, `scripts/distribute-android-release.ps1`) for automated Capacitor Android release builds and Firebase App Distribution.

---

## 🌟 Core Features & Modules

### 1. Slip OCR & Auto-Save Upload (`src/pages/UploadPage.tsx`)
- **Automated Scanning**: Users upload 1 or multiple transfer/payment slips (camera or gallery).
- **Gemini OCR Engine**: Calls `supabase.functions.invoke('extract-document')`.
- **Auto-Save Loop**: Complete extracted entries (valid amount & date) save automatically to Supabase without requiring manual review stops. Incomplete entries smoothly open for user review. Duplicates are auto-skipped.

### 2. NCB PDF & Debt Statement Parser (`src/components/DebtImportModal.tsx`, `src/lib/documentUpload.ts`)
- Accepts Credit Bureau PDF reports (NCB PDF) or e-Statement files/photos.
- Extracts Creditor, Outstanding Balance, Minimum Payment Due, Annual Interest Rate, and Due Date automatically, allowing one-tap import into the debt portfolio.

### 3. Debt Payoff Portfolio Strategy (`src/lib/debtPortfolioStrategy.ts`, `src/lib/debtSimulator.ts`)
- **Snowball Strategy**: Smallest balance first for psychological early wins.
- **Avalanche Strategy**: Highest interest rate first to minimize total interest paid.
- **Side-by-Side Comparison**: `DebtStrategyPage.tsx` compares both strategies and recommends the most cost-effective approach.

### 4. Debt Freedom Date Widget & Simulator (`src/components/DebtFreedomWidget.tsx`)
- Calculates the final payoff month/year across all active debts.
- **Extra Payment Simulator**: Interactive chips (`+฿500`, `+฿1,000`, `+฿2,000`/month) recalculate payoff dates and show real-time interest savings and months saved.

### 5. Smart Merchant Categorization (`src/lib/merchantRules.ts`)
- Automatically learns user merchant-to-category associations upon transaction save/edit.
- Pre-seeded with common Thai merchants (7-Eleven, Lotus, Big C, Cafe Amazon, PTT, Shell, Grab, Shopee, Lazada, AIS, True, etc.).

### 6. Smart Debt Reminders (`src/lib/notifications.ts`)
- Schedules Capacitor Local Notifications for active debts: **3 days before** and **1 day before** due date at 09:00 AM.
- Includes debt name, due date, and formatted minimum payment amount in notification text.

### 7. Financial Health Score & Grade (`src/lib/financialHealthScore.ts`, `src/components/FinancialHealthCard.tsx`)
- Calculates a 0-100 score and financial grade (**A+ to D**) based on Debt-to-Income (DTI) ratio, savings/surplus rate, and active debt risk.
- Provides actionable AI advice cards on `OverviewPage.tsx`.

### 8. Daily Safe Spend Limit (`src/lib/dailySpendLimit.ts`, `src/components/DailySpendCard.tsx`)
- Calculates daily disposable allowance (`(Income - Debt Obligations - Expenses) / Days Remaining in Month`).
- Displays animated progress bar and budget status on `TodayPage.tsx`.

### 9. Privacy Mode & App Switcher Blur Overlay (`src/lib/privacyStore.ts`, `src/components/PrivacyBlurOverlay.tsx`)
- **Eye Toggle Button**: Header button (`👁️ / 🙈`) masks all monetary figures across the app as `฿***,***`.
- **App Switcher Blur**: Automatically overlays a `backdrop-filter: blur(30px)` mask when the app is backgrounded or shown in the recent apps switcher.

---

## 🎨 UI/UX Design Guidelines
- **Theme Palette**: Deep Navy (`#0f172a`), Indigo Accent (`#4f46e5`), Emerald Income (`#10b981`), Amber Debt (`#d97706`), Rose Alert (`#ef4444`).
- **Cards & Elevation**: Rounded corners (`var(--tl-radius)` = 20px), soft elevation shadows, mesh gradients on hero cards.
- **Micro-Animations**: `fadeIn`, `slideDown`, active scale effects on tap rows (`transform: scale(0.985)`).
- **Typography**: Tabular numerals for monetary figures, clean Thai font hierarchy (`Noto Sans Thai`).

---

## 🧪 Testing & Release Workflow
- **Run Unit Tests**: `npm run test.unit -- --run` (Vitest)
- **Run Production Build**: `npm run build` (tsc & vite)
- **Release Android APK**: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-android-release.ps1`
- **Distribute to Testers**: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/distribute-android-release.ps1`
