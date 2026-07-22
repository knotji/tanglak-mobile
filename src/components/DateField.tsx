import { useState } from 'react';
import { IonButton, IonDatetime, IonIcon, IonModal } from '@ionic/react';
import { calendarOutline } from 'ionicons/icons';
import { formatThaiDateLabel } from '@/lib/date';

interface DateFieldProps {
  /** "YYYY-MM-DD". */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const DateField: React.FC<DateFieldProps> = ({ value, onChange, placeholder = 'เลือกวันที่' }) => {
  const [open, setOpen] = useState(false);
  const label = value ? formatThaiDateLabel(value) : null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="tl-field-trigger">
        <span style={{ color: label ? 'var(--ion-text-color)' : 'var(--tl-text-secondary)' }}>
          {label ?? placeholder}
        </span>
        <IonIcon icon={calendarOutline} style={{ fontSize: 18, color: '#4f46e5', flexShrink: 0 }} />
      </button>

      <IonModal className="tl-compact-modal" isOpen={open} onDidDismiss={() => setOpen(false)}>
        <div style={{ padding: '20px 20px 24px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: '#cbd5e1', margin: '0 auto 14px' }} />
          <p style={{ margin: '0 0 12px', textAlign: 'center', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>เลือกวันที่</p>
          <IonDatetime
            presentation="date"
            locale="th-TH-u-ca-gregory"
            value={value || undefined}
            onIonChange={(e) => {
              const raw = Array.isArray(e.detail.value) ? e.detail.value[0] : e.detail.value;
              const match = typeof raw === 'string' ? raw.match(/^(\d{4}-\d{2}-\d{2})/) : null;
              if (match) onChange(match[1]);
            }}
          />
          <IonButton
            expand="block"
            onClick={() => setOpen(false)}
            style={{
              marginTop: 18,
              '--border-radius': '999px',
              '--background': 'linear-gradient(135deg, #0f172a 0%, #312e81 100%)',
              '--box-shadow': '0 8px 20px -4px rgba(15, 23, 42, 0.3)',
              fontWeight: 700,
              fontSize: 15,
              minHeight: 48,
            }}
          >
            เสร็จสิ้น
          </IonButton>
        </div>
      </IonModal>
    </>
  );
};

export default DateField;
