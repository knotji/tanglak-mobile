import FieldLabel from '@/components/FieldLabel';
import { formatThaiDateTimeLabel } from '@/lib/date';

interface DateTimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}

/** datetime-local input + an unambiguous Thai-formatted confirmation label underneath (see src/lib/date.ts). */
const DateTimeField: React.FC<DateTimeFieldProps> = ({ value, onChange, hint }) => {
  const label = formatThaiDateTimeLabel(value);

  return (
    <div>
      <FieldLabel>วันที่และเวลา</FieldLabel>
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid var(--tl-border)',
          fontFamily: 'inherit',
          fontSize: 16,
        }}
      />
      {!value && (
        <p style={{ fontSize: 12, marginTop: 4, color: 'var(--tl-debt)' }}>กรุณาระบุวันและเวลาที่ทำรายการ</p>
      )}
      {value && !label && (
        <p style={{ fontSize: 12, marginTop: 4, color: 'var(--tl-overdue)' }}>กรุณาตรวจสอบวันและเวลาให้ถูกต้อง</p>
      )}
      {value && label && (
        <p style={{ fontSize: 12, marginTop: 4, color: 'var(--tl-text-secondary)' }}>
          {label}
          {hint ? ` — ${hint}` : ''}
        </p>
      )}
    </div>
  );
};

export default DateTimeField;
