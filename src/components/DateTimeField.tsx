import { useState } from 'react';
import { IonButton, IonDatetime, IonModal, IonText } from '@ionic/react';
import FieldLabel from '@/components/FieldLabel';
import { formatThaiDateTimeLabel } from '@/lib/date';

interface DateTimeFieldProps {
  /** "YYYY-MM-DDTHH:mm" (Bangkok wall-clock, no timezone conversion). */
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}

/**
 * Was a native `datetime-local` input -- its own rendering is locale-
 * dependent (showed MM/DD/YYYY, ambiguous to a Thai reader even when the
 * underlying value was correct; see the earlier fix that added a Thai
 * label alongside it). Replaced with IonDatetime in a modal so both the
 * display AND the editing UI are Thai/Gregorian, not just a label bolted
 * on next to a browser-locale-dependent control.
 */
const DateTimeField: React.FC<DateTimeFieldProps> = ({ value, onChange, hint }) => {
  const [open, setOpen] = useState(false);
  const label = formatThaiDateTimeLabel(value);

  return (
    <div>
      <FieldLabel>วันที่และเวลา</FieldLabel>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid var(--tl-border)',
          background: 'var(--tl-surface)',
          fontFamily: 'inherit',
          fontSize: 16,
          color: label ? 'var(--ion-text-color)' : 'var(--tl-text-secondary)',
        }}
      >
        {label ?? 'เลือกวันที่และเวลา'}
      </button>

      {!value && (
        <IonText color="warning"><p style={{ fontSize: 12, marginTop: 4 }}>กรุณาระบุวันและเวลาที่ทำรายการ</p></IonText>
      )}
      {hint && (
        <p style={{ fontSize: 12, marginTop: 4, color: 'var(--tl-text-secondary)' }}>{hint}</p>
      )}

      <IonModal isOpen={open} onDidDismiss={() => setOpen(false)}>
        <div style={{ padding: 16 }}>
          <IonDatetime
            presentation="date-time"
            locale="th-TH-u-ca-gregory"
            hourCycle="h23"
            value={value ? `${value}:00` : undefined}
            onIonChange={(e) => {
              const raw = Array.isArray(e.detail.value) ? e.detail.value[0] : e.detail.value;
              const match = typeof raw === 'string' ? raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/) : null;
              if (match) onChange(`${match[1]}T${match[2]}`);
            }}
          />
          <IonButton expand="block" className="ion-margin-top" onClick={() => setOpen(false)}>เสร็จสิ้น</IonButton>
        </div>
      </IonModal>
    </div>
  );
};

export default DateTimeField;
