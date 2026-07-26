// Shared color tokens for the small badge/status "tone" pattern used across
// several pages (a colored background + matching foreground text, keyed by
// some status enum). Each page's own lookup table (e.g. DebtCard's
// STATUS_TONE, DebtSimulatePage's AFFORDABILITY_TONE, EditTransactionPage's
// TYPE_THEME) still defines its own Record<EnumType, Tone> mapping, since
// the enums and exact tone assignments differ per page -- but they draw
// from this shared palette instead of each re-typing the same raw hex
// values, so a color tweak here doesn't need hunting across every file.
export interface Tone {
  bg: string;
  fg: string;
}

export const TONE = {
  neutral: { bg: '#f1f5f9', fg: '#64748b' } satisfies Tone,
  warning: { bg: '#fef3c7', fg: '#b45309' } satisfies Tone,
  danger: { bg: '#fee2e2', fg: '#dc2626' } satisfies Tone,
  success: { bg: '#d1fae5', fg: '#047857' } satisfies Tone,
  successSoft: { bg: '#ecfdf5', fg: '#047857' } satisfies Tone,
} as const;
