import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  extractDocument: vi.fn(),
  saveTransaction: vi.fn(),
  checkDuplicateTransaction: vi.fn(),
}));

vi.mock('@ionic/react', () => ({
  IonButton: ({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>{children}</button>
  ),
  IonContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IonIcon: () => null,
  IonInput: (props: { value?: string }) => <input value={props.value ?? ''} readOnly />,
  IonPage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  IonSegment: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IonSegmentButton: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IonSelect: ({ children }: { children: ReactNode }) => <select>{children}</select>,
  IonSelectOption: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
  IonSpinner: () => <span>loading</span>,
  IonText: ({ children }: { children: ReactNode }) => <>{children}</>,
  useIonViewWillEnter: () => undefined,
}));
vi.mock('@/components/PageHeader', () => ({
  default: ({ title, subtitle }: { title: string; subtitle: string }) => <header><h1>{title}</h1><p>{subtitle}</p></header>,
}));
vi.mock('@/components/FieldLabel', () => ({
  default: ({ children }: { children: ReactNode }) => <label>{children}</label>,
}));
vi.mock('@/components/DateTimeField', () => ({
  default: ({ value }: { value: string }) => <div>{value}</div>,
}));
vi.mock('@/lib/documentUpload', () => ({ extractDocument: mocks.extractDocument }));
vi.mock('@/lib/saveTransaction', () => ({ saveTransaction: mocks.saveTransaction }));
vi.mock('@/lib/transactions', () => ({ checkDuplicateTransaction: mocks.checkDuplicateTransaction }));
vi.mock('@/lib/merchantRules', () => ({
  findCategoryForMerchant: () => null,
  learnMerchantCategoryRule: vi.fn(),
}));

import UploadPage from '@/pages/UploadPage';

describe('UploadPage review boundary', () => {
  beforeEach(() => {
    mocks.extractDocument.mockReset();
    mocks.saveTransaction.mockReset();
    mocks.checkDuplicateTransaction.mockReset();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  });

  it('shows an extracted transaction for review without saving it', async () => {
    mocks.extractDocument.mockResolvedValue({
      documentType: 'receipt',
      confidence: 0.95,
      transaction: {
        type: 'expense',
        amount: 125.5,
        occurredAt: '2026-07-30T08:00:00+07:00',
        merchant: 'ร้านทดสอบ',
        categoryId: 'food',
      },
      warnings: [],
      unclearFields: [],
      requiresReview: true,
    });

    const { container } = render(<UploadPage />);
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, { target: { files: [new File(['slip'], 'slip.jpg', { type: 'image/jpeg' })] } });

    expect(await screen.findByDisplayValue('125.5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ร้านทดสอบ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'บันทึกรายการ' })).toBeInTheDocument();
    await waitFor(() => expect(mocks.saveTransaction).not.toHaveBeenCalled());
  });
});
