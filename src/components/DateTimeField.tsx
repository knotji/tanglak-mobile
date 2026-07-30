import { useState } from 'react';
import { IonButton, IonDatetime, IonIcon, IonModal, IonText } from '@ionic/react';
import { calendarOutline } from 'ionicons/icons';
import { formatThaiDateTimeLabel } from '@/lib/date';

interface DateTimeFieldProps {
  /** "YYYY-MM-DDTHH:mm" (Bangkok wall-clock, no timezone conversion). */
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}

const DateTimeField: React.FC<DateTimeFieldProps> = ({ value, onChange, hint }) => {
  const [open, setOpen] = useState(false);
  const label = formatThaiDateTimeLabel(value);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div className="tl-icon-badge tl-icon-badge--income" style={{ width: 34, height: 34, fontSize: 16 }}>
          <IonIcon aria-hidden="true" icon={calendarOutline} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>วันที่และเวลา</span>
      </div>

      <div style={{ paddingLeft: 44 }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            fontFamily: 'inherit',
            fontSize: 15,
            fontWeight: 600,
            color: label ? 'var(--ion-text-color)' : 'var(--tl-text-secondary)',
            textAlign: 'left',
            padding: '6px 0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{label ?? 'เลือกวันที่และเวลา'}</span>
        </button>

        {!value && (
          <IonText color="warning"><p style={{ fontSize: 12, marginTop: 2 }}>กรุณาระบุวันและเวลาที่ทำรายการ</p></IonText>
        )}
        {hint && (
          <p style={{ fontSize: 12, marginTop: 2, color: 'var(--tl-text-secondary)' }}>{hint}</p>
        )}
      </div>

      <IonModal className="tl-compact-modal" isOpen={open} onDidDismiss={() => setOpen(false)}>
        <div style={{ padding: '20px 20px 24px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: '#cbd5e1', margin: '0 auto 14px' }} />
          <p style={{ margin: '0 0 12px', textAlign: 'center', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>เลือกวันที่และเวลา</p>
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
    </div>
  );
};

export default DateTimeField;
