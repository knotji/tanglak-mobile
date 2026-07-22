import { useState } from 'react';
import { IonButton, IonDatetime, IonModal } from '@ionic/react';
import { formatThaiDateLabel } from '@/lib/date';

interface DateFieldProps {
  /** "YYYY-MM-DD". */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Date-only counterpart of DateTimeField -- same IonDatetime-in-a-modal approach, no native <input type="date">. */
const DateField: React.FC<DateFieldProps> = ({ value, onChange, placeholder = 'เลือกวันที่' }) => {
  const [open, setOpen] = useState(false);
  const label = value ? formatThaiDateLabel(value) : null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="tl-field-trigger" style={{ color: label ? 'var(--ion-text-color)' : 'var(--tl-text-secondary)' }}>
        {label ?? placeholder}
      </button>

      <IonModal className="tl-compact-modal" isOpen={open} onDidDismiss={() => setOpen(false)}>
        <div style={{ padding: 16 }}>
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
          <IonButton expand="block" className="ion-margin-top" onClick={() => setOpen(false)}>เสร็จสิ้น</IonButton>
        </div>
      </IonModal>
    </>
  );
};

export default DateField;
