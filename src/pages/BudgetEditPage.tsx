import { useState } from 'react';
import {
  IonAlert,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonModal,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonToast,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { sparklesOutline, trashOutline } from 'ionicons/icons';
import {
  getOrCreateEditableBudget,
  setMonthlyIncome,
  addBudgetCategory,
  updateBudgetCategoryAmount,
  deleteBudgetCategory,
  type BudgetCategoryRow,
} from '@/lib/budget';
import { listTransactionsForMonth } from '@/lib/transactions';
import { currentBangkokMonth, shiftBangkokMonth } from '@/lib/bangkokDate';
import { suggestBudgetFromHistory, type BudgetSuggestion } from '@/lib/budgetSuggestion';
import { CATEGORY_OPTIONS } from '@/lib/categories';
import { formatTHB } from '@/lib/money';
import PageHeader from '@/components/PageHeader';
import FieldLabel from '@/components/FieldLabel';

const BUDGETABLE_CATEGORIES = CATEGORY_OPTIONS.filter((option) => option.kind === 'expense' && option.id !== 'transfers');
const SUGGESTION_HISTORY_MONTHS = 3;

const BudgetEditPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [budgetId, setBudgetId] = useState<string | null>(null);
  const [income, setIncome] = useState('');
  const [categories, setCategories] = useState<BudgetCategoryRow[]>([]);
  const [newCategoryId, setNewCategoryId] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<BudgetSuggestion | null>(null);
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [applyingSuggestion, setApplyingSuggestion] = useState(false);

  useIonViewWillEnter(() => {
    setLoading(true);
    void getOrCreateEditableBudget()
      .then((budget) => {
        setBudgetId(budget.monthlyBudgetId);
        setIncome(budget.incomeSatang > 0 ? String(budget.incomeSatang / 100) : '');
        setCategories(budget.categories);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'โหลดงบประมาณไม่สำเร็จ'))
      .finally(() => setLoading(false));
  });

  const handleIncomeBlur = async () => {
    if (!budgetId) return;
    try {
      await setMonthlyIncome(budgetId, income || '0');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกรายรับไม่สำเร็จ');
    }
  };

  const handleAddCategory = async () => {
    if (!budgetId || !newCategoryId) return;
    const option = BUDGETABLE_CATEGORIES.find((c) => c.id === newCategoryId);
    if (!option) return;
    try {
      const row = await addBudgetCategory(budgetId, option.label, '0');
      setCategories((current) => [...current, row]);
      setNewCategoryId('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เพิ่มหมวดหมู่ไม่สำเร็จ');
    }
  };

  const handleCategoryAmountChange = (id: string, value: string) => {
    setCategories((current) => current.map((c) => (c.id === id ? { ...c, amountSatang: Number(value || '0') * 100 } : c)));
  };

  const handleCategoryAmountBlur = async (id: string, value: string) => {
    try {
      await updateBudgetCategoryAmount(id, value || '0');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกหมวดหมู่ไม่สำเร็จ');
    }
  };

  const handleDeleteCategory = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await deleteBudgetCategory(id);
      setCategories((current) => current.filter((c) => c.id !== id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ลบหมวดหมู่ไม่สำเร็จ');
    }
  };

  const handleOpenSuggestions = async () => {
    setSuggestionOpen(true);
    setSuggestionLoading(true);
    setSuggestion(null);
    setSelectedLabels(new Set());
    try {
      const currentMonth = currentBangkokMonth();
      // The current month is deliberately excluded -- it's still in
      // progress and would understate real monthly spend (e.g. analyzing
      // on the 3rd of the month would show almost nothing spent yet).
      const priorMonths = Array.from({ length: SUGGESTION_HISTORY_MONTHS }, (_, i) => shiftBangkokMonth(currentMonth, -(i + 1)));
      const monthTransactions = await Promise.all(priorMonths.map((m) => listTransactionsForMonth(m)));
      const result = suggestBudgetFromHistory(monthTransactions);
      setSuggestion(result);
      // Pre-select every suggested category not already budgeted -- an
      // already-budgeted category is left unchecked by default so applying
      // suggestions doesn't silently overwrite a number the user set on
      // purpose, without the user having to uncheck it themselves first.
      const alreadyBudgeted = new Set(categories.map((c) => c.label));
      setSelectedLabels(new Set(result.categories.filter((c) => !alreadyBudgeted.has(c.label)).map((c) => c.label)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'วิเคราะห์ประวัติการใช้จ่ายไม่สำเร็จ');
      setSuggestionOpen(false);
    } finally {
      setSuggestionLoading(false);
    }
  };

  const toggleSuggestionLabel = (label: string, checked: boolean) => {
    setSelectedLabels((current) => {
      const next = new Set(current);
      if (checked) next.add(label);
      else next.delete(label);
      return next;
    });
  };

  const handleApplySuggestions = async () => {
    if (!budgetId || !suggestion) return;
    setApplyingSuggestion(true);
    try {
      for (const item of suggestion.categories) {
        if (!selectedLabels.has(item.label)) continue;
        const existing = categories.find((c) => c.label === item.label);
        const amountBaht = String(item.suggestedSatang / 100);
        if (existing) {
          await updateBudgetCategoryAmount(existing.id, amountBaht);
          setCategories((current) => current.map((c) => (c.id === existing.id ? { ...c, amountSatang: item.suggestedSatang } : c)));
        } else {
          const row = await addBudgetCategory(budgetId, item.label, amountBaht);
          setCategories((current) => [...current, row]);
        }
      }
      setSuggestionOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'นำงบที่แนะนำไปใช้ไม่สำเร็จ');
    } finally {
      setApplyingSuggestion(false);
    }
  };

  const availableToAdd = BUDGETABLE_CATEGORIES.filter((option) => !categories.some((c) => c.label === option.label));

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/budget" text="" />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding" fullscreen>
        <PageHeader title="ตั้งงบประมาณ" subtitle="งบประมาณเดือนนี้" />

        {loading && <div className="ion-text-center ion-margin-top"><IonSpinner /></div>}

        {!loading && (
          <>
            <div className="tl-card">
              <FieldLabel>รายรับเดือนนี้ (บาท)</FieldLabel>
              <IonInput
                fill="outline"
                type="number"
                inputmode="decimal"
                value={income}
                onIonInput={(e) => setIncome(e.detail.value ?? '')}
                onIonBlur={() => void handleIncomeBlur()}
              />
            </div>

            <button type="button" className="tl-tap-row" onClick={() => void handleOpenSuggestions()} style={{ marginTop: 12 }}>
              <div
                className="tl-card"
                style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)', borderColor: '#c7d2fe' }}
              >
                <div className="tl-icon-badge tl-icon-badge--transfer" style={{ background: '#4f46e5', color: '#ffffff' }}>
                  <IonIcon icon={sparklesOutline} />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--ion-text-color)' }}>แนะนำงบจากประวัติการใช้จ่าย</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--tl-text-secondary)', fontWeight: 500 }}>
                    วิเคราะห์ {SUGGESTION_HISTORY_MONTHS} เดือนล่าสุดที่ผ่านมา แล้วแนะนำงบต่อหมวดหมู่ให้
                  </p>
                </div>
              </div>
            </button>

            <div className="tl-card" style={{ marginTop: 12, marginBottom: 'calc(28px + env(safe-area-inset-bottom, 0px))' }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700 }}>งบต่อหมวดหมู่</p>
              {categories.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--tl-text-secondary)' }}>ยังไม่มีหมวดหมู่ที่ตั้งงบ — เพิ่มด้านล่าง</p>
              )}
              {categories.map((category, index) => (
                <div
                  key={category.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 0',
                    borderTop: index === 0 ? 'none' : '1px solid var(--tl-border)',
                  }}
                >
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{category.label}</span>
                  <IonInput
                    fill="outline"
                    type="number"
                    inputmode="decimal"
                    style={{ maxWidth: 110 }}
                    value={category.amountSatang > 0 ? String(category.amountSatang / 100) : ''}
                    placeholder="0"
                    onIonInput={(e) => handleCategoryAmountChange(category.id, e.detail.value ?? '')}
                    onIonBlur={(e) => void handleCategoryAmountBlur(category.id, (e.target as HTMLIonInputElement).value as string)}
                  />
                  <IonButton fill="clear" color="danger" onClick={() => setConfirmDeleteId(category.id)} aria-label={`ลบหมวดหมู่ ${category.label}`}>
                    <IonIcon icon={trashOutline} slot="icon-only" />
                  </IonButton>
                </div>
              ))}

              {availableToAdd.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <IonSelect
                    fill="outline"
                    interface="action-sheet"
                    placeholder="เลือกหมวดหมู่ที่จะเพิ่ม"
                    style={{ flex: 1 }}
                    value={newCategoryId}
                    onIonChange={(e) => setNewCategoryId(e.detail.value)}
                  >
                    {availableToAdd.map((option) => (
                      <IonSelectOption key={option.id} value={option.id}>{option.label}</IonSelectOption>
                    ))}
                  </IonSelect>
                  <IonButton disabled={!newCategoryId} onClick={() => void handleAddCategory()} style={{ '--border-radius': '999px', fontWeight: 700, '--background': 'linear-gradient(135deg, #0f172a 0%, #312e81 100%)' }}>เพิ่ม</IonButton>
                </div>
              )}
            </div>
          </>
        )}

        <IonAlert
          isOpen={confirmDeleteId !== null}
          onDidDismiss={() => setConfirmDeleteId(null)}
          header="ลบหมวดหมู่นี้?"
          buttons={[
            { text: 'ยกเลิก', role: 'cancel', handler: () => setConfirmDeleteId(null) },
            { text: 'ลบ', role: 'destructive', handler: () => { void handleDeleteCategory(); } },
          ]}
        />
        <IonToast isOpen={error !== ''} message={error} duration={3000} color="danger" onDidDismiss={() => setError('')} />

        <IonModal className="tl-compact-modal" isOpen={suggestionOpen} onDidDismiss={() => setSuggestionOpen(false)}>
          <div style={{ padding: '20px 20px 24px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 999, background: '#cbd5e1', margin: '0 auto 14px' }} />
            <p style={{ margin: '0 0 4px', textAlign: 'center', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>แนะนำงบจากประวัติการใช้จ่าย</p>

            {suggestionLoading && (
              <div className="ion-text-center ion-margin-top"><IonSpinner /></div>
            )}

            {!suggestionLoading && suggestion?.insufficientData && (
              <p style={{ marginTop: 12, fontSize: 13, color: 'var(--tl-text-secondary)', textAlign: 'center' }}>
                ยังมีประวัติการใช้จ่ายไม่พอให้วิเคราะห์ ({suggestion.totalTransactionsAnalyzed} รายการใน {suggestion.monthsAnalyzed} เดือนที่ผ่านมา) — ลองใหม่อีกครั้งเมื่อมีรายการมากขึ้น
              </p>
            )}

            {!suggestionLoading && suggestion && !suggestion.insufficientData && (
              <>
                <p style={{ margin: '2px 0 14px', fontSize: 12.5, color: 'var(--tl-text-secondary)', textAlign: 'center' }}>
                  จากค่าเฉลี่ย {suggestion.monthsAnalyzed} เดือนที่ผ่านมา ({suggestion.totalTransactionsAnalyzed} รายการ) เลือกหมวดที่จะนำมาใช้
                </p>
                <div className="tl-card" style={{ padding: '4px 16px' }}>
                  {suggestion.categories.map((item, index) => {
                    const alreadyBudgeted = categories.some((c) => c.label === item.label);
                    return (
                      <div
                        key={item.label}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: index === 0 ? 'none' : '1px solid var(--tl-border)' }}
                      >
                        <IonCheckbox
                          checked={selectedLabels.has(item.label)}
                          onIonChange={(e) => toggleSuggestionLabel(item.label, e.detail.checked)}
                          aria-label={`เลือกหมวดหมู่ ${item.label}`}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{item.label}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--tl-text-secondary)' }}>
                            {alreadyBudgeted ? 'มีงบอยู่แล้ว — จะถูกแทนที่' : 'ยังไม่มีงบ'}
                            {item.monthsWithSpend < suggestion.monthsAnalyzed && ` · ใช้จ่ายแค่ ${item.monthsWithSpend}/${suggestion.monthsAnalyzed} เดือน`}
                          </p>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>{formatTHB(item.suggestedSatang)}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {error && (
              <IonText color="danger"><p style={{ marginTop: 12, fontSize: 13, textAlign: 'center', fontWeight: 600 }}>{error}</p></IonText>
            )}

            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!suggestionLoading && suggestion && !suggestion.insufficientData && (
                <IonButton
                  expand="block"
                  disabled={applyingSuggestion || selectedLabels.size === 0}
                  onClick={() => void handleApplySuggestions()}
                  style={{
                    '--border-radius': '999px',
                    '--background': 'linear-gradient(135deg, #0f172a 0%, #312e81 100%)',
                    fontWeight: 700,
                    fontSize: 15,
                    minHeight: 48,
                  }}
                >
                  {applyingSuggestion ? <IonSpinner name="dots" /> : `ใช้งบที่เลือก (${selectedLabels.size})`}
                </IonButton>
              )}
              <IonButton expand="block" fill="clear" disabled={applyingSuggestion} onClick={() => setSuggestionOpen(false)} style={{ fontWeight: 600 }}>
                ปิด
              </IonButton>
            </div>
          </div>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default BudgetEditPage;
