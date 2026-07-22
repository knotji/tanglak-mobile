import { useState } from 'react';
import {
  IonAlert,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonToast,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { trashOutline } from 'ionicons/icons';
import {
  getOrCreateEditableBudget,
  setMonthlyIncome,
  addBudgetCategory,
  updateBudgetCategoryAmount,
  deleteBudgetCategory,
  type BudgetCategoryRow,
} from '@/lib/budget';
import { CATEGORY_OPTIONS } from '@/lib/categories';
import PageHeader from '@/components/PageHeader';
import FieldLabel from '@/components/FieldLabel';

const BUDGETABLE_CATEGORIES = CATEGORY_OPTIONS.filter((option) => option.kind === 'expense' && option.id !== 'transfers');

const BudgetEditPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [budgetId, setBudgetId] = useState<string | null>(null);
  const [income, setIncome] = useState('');
  const [categories, setCategories] = useState<BudgetCategoryRow[]>([]);
  const [newCategoryId, setNewCategoryId] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');

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

            <div className="tl-card">
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
                  <IonButton disabled={!newCategoryId} onClick={() => void handleAddCategory()}>เพิ่ม</IonButton>
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
      </IonContent>
    </IonPage>
  );
};

export default BudgetEditPage;
