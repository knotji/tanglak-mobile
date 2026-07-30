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
import { suggestBudgetFromHistory, suggestBudgetFromIncomeRatio, type BudgetSuggestion, type IncomeRatioSuggestion } from '@/lib/budgetSuggestion';
import { requestAiBudgetPlan, summarizeBudgetHistory, type AiBudgetPlan } from '@/lib/aiBudget';
import { applyBudgetPlan } from '@/lib/applyBudgetPlan';
import { CATEGORY_OPTIONS, categoryLabel } from '@/lib/categories';
import { formatTHB, bahtToSatang } from '@/lib/money';
import PageHeader from '@/components/PageHeader';
import FieldLabel from '@/components/FieldLabel';

const BUDGETABLE_CATEGORIES = CATEGORY_OPTIONS.filter((option) => option.kind === 'expense' && option.id !== 'transfers');
const SUGGESTION_HISTORY_MONTHS = 3;

/** One row in the suggestion list/modal -- shared between the history-based and income-ratio-based suggestion UIs. */
const SuggestionRow: React.FC<{
  label: string;
  suggestedSatang: number;
  note: string | null;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  alreadyBudgeted: boolean;
  first: boolean;
}> = ({ label, suggestedSatang, note, checked, onToggle, alreadyBudgeted, first }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: first ? 'none' : '1px solid var(--tl-border)' }}>
    <IonCheckbox checked={checked} onIonChange={(e) => onToggle(e.detail.checked)} aria-label={`เลือกหมวดหมู่ ${label}`} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--tl-text-secondary)' }}>
        {alreadyBudgeted ? 'มีงบอยู่แล้ว — จะถูกแทนที่' : 'ยังไม่มีงบ'}
        {note && ` · ${note}`}
      </p>
    </div>
    <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>{formatTHB(suggestedSatang)}</span>
  </div>
);

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
  const [ratioSuggestion, setRatioSuggestion] = useState<IncomeRatioSuggestion | null>(null);
  const [aiPlan, setAiPlan] = useState<AiBudgetPlan | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState('');
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
    setRatioSuggestion(null);
    setAiPlan(null);
    setFallbackNotice('');
    setSelectedLabels(new Set());
    try {
      const currentMonth = currentBangkokMonth();
      // The current month is deliberately excluded -- it's still in
      // progress and would understate real monthly spend (e.g. analyzing
      // on the 3rd of the month would show almost nothing spent yet).
      const priorMonths = Array.from({ length: SUGGESTION_HISTORY_MONTHS }, (_, i) => shiftBangkokMonth(currentMonth, -(i + 1)));
      const monthTransactions = await Promise.all(priorMonths.map((m) => listTransactionsForMonth(m)));
      const incomeSatang = bahtToSatang(income || '0');
      const categoryIdByLabel = new Map(BUDGETABLE_CATEGORIES.map((item) => [item.label, item.id]));
      const history = summarizeBudgetHistory(
        priorMonths.map((month, index) => ({ month, transactions: monthTransactions[index] })),
        categoryIdByLabel,
      );
      const currentBudgets = categories.flatMap((item) => {
        const categoryId = categoryIdByLabel.get(item.label);
        return categoryId ? [{ categoryId, label: item.label, amountSatang: item.amountSatang }] : [];
      });

      if (incomeSatang > 0) {
        try {
          const plan = await requestAiBudgetPlan({
            monthlyIncomeSatang: incomeSatang,
            history,
            currentBudgets,
            availableCategories: BUDGETABLE_CATEGORIES.map(({ id, label }) => ({ id, label })),
          });
          setAiPlan(plan);
          setSelectedLabels(new Set(plan.items.map((item) => item.label)));
          return;
        } catch (cause) {
          setFallbackNotice(
            `${cause instanceof Error ? cause.message : 'AI ยังวิเคราะห์งบไม่ได้'} — แสดงสูตรพื้นฐานสำรองให้แทน`,
          );
        }
      } else {
        setFallbackNotice('กรอกรายรับเดือนนี้ก่อนเพื่อให้ AI วางแผนได้ — แสดงคำแนะนำจากประวัติแทน');
      }

      const result = suggestBudgetFromHistory(monthTransactions);

      const alreadyBudgeted = new Set(categories.map((c) => c.label));

      if (!result.insufficientData) {
        setSuggestion(result);
        // Pre-select every suggested category not already budgeted -- an
        // already-budgeted category is left unchecked by default so applying
        // suggestions doesn't silently overwrite a number the user set on
        // purpose, without the user having to uncheck it themselves first.
        setSelectedLabels(new Set(result.categories.filter((c) => !alreadyBudgeted.has(c.label)).map((c) => c.label)));
        return;
      }

      // Not enough real spending history to average -- fall back to a
      // generic income-ratio rule of thumb instead (see
      // suggestBudgetFromIncomeRatio's own comment: this is NOT a
      // personalized AI analysis, just a common budgeting framework
      // applied to this app's category list, clearly labeled as such below).
      const ratioResult = suggestBudgetFromIncomeRatio(incomeSatang, categoryLabel);
      setRatioSuggestion(ratioResult);
      if (!ratioResult.insufficientData) {
        const allRatioItems = [...ratioResult.needs, ...ratioResult.wants];
        setSelectedLabels(new Set(allRatioItems.filter((item) => !alreadyBudgeted.has(item.label)).map((item) => item.label)));
      }
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
    if (!budgetId) return;
    const items: { label: string; suggestedSatang: number }[] = aiPlan
      ? aiPlan.items
      : suggestion
        ? suggestion.categories
        : ratioSuggestion
          ? [...ratioSuggestion.needs, ...ratioSuggestion.wants]
          : [];
    if (items.length === 0) return;

    setApplyingSuggestion(true);
    try {
      const nextCategories = await applyBudgetPlan({
        budgetId,
        categories,
        items,
        selectedLabels,
        operations: {
          update: updateBudgetCategoryAmount,
          add: addBudgetCategory,
          remove: deleteBudgetCategory,
        },
      });
      setCategories(nextCategories);
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
                  <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--ion-text-color)' }}>ให้ AI ช่วยจัดงบ</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--tl-text-secondary)', fontWeight: 500 }}>
                    วิเคราะห์รายรับและยอดรวม {SUGGESTION_HISTORY_MONTHS} เดือนล่าสุด แล้วสร้างแผนให้ตรวจสอบก่อนใช้
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
            <p style={{ margin: '0 0 4px', textAlign: 'center', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>แผนงบจาก AI</p>

            {suggestionLoading && (
              <div className="ion-text-center ion-margin-top"><IonSpinner /></div>
            )}

            {!suggestionLoading && fallbackNotice && (
              <div
                role="status"
                style={{
                  background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '10px 12px', marginTop: 12,
                  fontSize: 12, color: '#9a3412', lineHeight: 1.5,
                }}
              >
                {fallbackNotice}
              </div>
            )}

            {!suggestionLoading && aiPlan && (
              <>
                <p style={{ margin: '10px 0 4px', fontSize: 13, color: 'var(--tl-text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
                  {aiPlan.summary}
                </p>
                <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#047857', textAlign: 'center', fontWeight: 700 }}>
                  กันเงินออม/เงินสำรองไว้ {formatTHB(aiPlan.savingsSatang)}
                </p>
                <div className="tl-card" style={{ padding: '4px 16px' }}>
                  {aiPlan.items.map((item, index) => (
                    <SuggestionRow
                      key={item.categoryId}
                      label={item.label}
                      suggestedSatang={item.suggestedSatang}
                      note={item.reason}
                      checked={selectedLabels.has(item.label)}
                      onToggle={(checked) => toggleSuggestionLabel(item.label, checked)}
                      alreadyBudgeted={categories.some((category) => category.label === item.label)}
                      first={index === 0}
                    />
                  ))}
                </div>
              </>
            )}

            {!suggestionLoading && ratioSuggestion?.insufficientData && (
              <p style={{ marginTop: 12, fontSize: 13, color: 'var(--tl-text-secondary)', textAlign: 'center' }}>
                กรุณากรอกรายรับเดือนนี้ก่อน ระบบจะแนะนำสัดส่วนงบให้จากรายรับ
              </p>
            )}

            {!suggestionLoading && ratioSuggestion && !ratioSuggestion.insufficientData && (
              <>
                <div
                  style={{
                    background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '10px 12px', marginBottom: 14,
                    fontSize: 12, color: '#9a3412', lineHeight: 1.5,
                  }}
                >
                  ยังมีประวัติการใช้จ่ายไม่พอให้วิเคราะห์จริง ({suggestion?.totalTransactionsAnalyzed ?? 0} รายการ) — นี่คือสัดส่วนงบตามหลักการเงินทั่วไป (จำเป็น 50% / อยากได้ 30% ของรายรับ) ไม่ใช่การวิเคราะห์เฉพาะบุคคล ปรับได้ตามจริงหลังใช้งานสักพัก
                </div>

                <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--tl-text-secondary)' }}>จำเป็น (50% ของรายรับ)</p>
                <div className="tl-card" style={{ padding: '4px 16px', marginBottom: 14 }}>
                  {ratioSuggestion.needs.map((item, index) => (
                    <SuggestionRow
                      key={item.label}
                      label={item.label}
                      suggestedSatang={item.suggestedSatang}
                      note={null}
                      checked={selectedLabels.has(item.label)}
                      onToggle={(checked) => toggleSuggestionLabel(item.label, checked)}
                      alreadyBudgeted={categories.some((c) => c.label === item.label)}
                      first={index === 0}
                    />
                  ))}
                </div>

                <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--tl-text-secondary)' }}>อยากได้ (30% ของรายรับ)</p>
                <div className="tl-card" style={{ padding: '4px 16px' }}>
                  {ratioSuggestion.wants.map((item, index) => (
                    <SuggestionRow
                      key={item.label}
                      label={item.label}
                      suggestedSatang={item.suggestedSatang}
                      note={null}
                      checked={selectedLabels.has(item.label)}
                      onToggle={(checked) => toggleSuggestionLabel(item.label, checked)}
                      alreadyBudgeted={categories.some((c) => c.label === item.label)}
                      first={index === 0}
                    />
                  ))}
                </div>
              </>
            )}

            {!suggestionLoading && suggestion && !suggestion.insufficientData && (
              <>
                <p style={{ margin: '2px 0 14px', fontSize: 12.5, color: 'var(--tl-text-secondary)', textAlign: 'center' }}>
                  จากค่าเฉลี่ย {suggestion.monthsAnalyzed} เดือนที่ผ่านมา ({suggestion.totalTransactionsAnalyzed} รายการ) เลือกหมวดที่จะนำมาใช้
                </p>
                <div className="tl-card" style={{ padding: '4px 16px' }}>
                  {suggestion.categories.map((item, index) => (
                    <SuggestionRow
                      key={item.label}
                      label={item.label}
                      suggestedSatang={item.suggestedSatang}
                      note={item.monthsWithSpend < suggestion.monthsAnalyzed ? `ใช้จ่ายแค่ ${item.monthsWithSpend}/${suggestion.monthsAnalyzed} เดือน` : null}
                      checked={selectedLabels.has(item.label)}
                      onToggle={(checked) => toggleSuggestionLabel(item.label, checked)}
                      alreadyBudgeted={categories.some((c) => c.label === item.label)}
                      first={index === 0}
                    />
                  ))}
                </div>
              </>
            )}

            {error && (
              <IonText color="danger"><p style={{ marginTop: 12, fontSize: 13, textAlign: 'center', fontWeight: 600 }}>{error}</p></IonText>
            )}

            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!suggestionLoading && (aiPlan || (suggestion && !suggestion.insufficientData) || (ratioSuggestion && !ratioSuggestion.insufficientData)) && (
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
                  {applyingSuggestion ? <IonSpinner name="dots" /> : `ยืนยันใช้แผนนี้ (${selectedLabels.size})`}
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
