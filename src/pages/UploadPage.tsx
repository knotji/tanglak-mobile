import { useState } from 'react';
import {
  IonBadge,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { cameraOutline } from 'ionicons/icons';
import { extractDocument, type ExtractedFinancialDocument } from '@/lib/documentUpload';
import { categoryLabel } from '@/lib/categories';

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  salary_slip: 'สลิปเงินเดือน',
  transfer_slip: 'สลิปโอนเงิน',
  receipt: 'ใบเสร็จ',
  delivery_receipt: 'ใบเสร็จเดลิเวอรี',
  debt_statement: 'ใบแจ้งหนี้',
  loan_schedule: 'ตารางผ่อนชำระ',
  other: 'เอกสารอื่น ๆ',
};

const UploadPage: React.FC = () => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ExtractedFinancialDocument | null>(null);

  const handleFile = async (file: File) => {
    setError('');
    setResult(null);
    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);
    try {
      setResult(await extractDocument(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'อ่านสลิปไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>สแกนสลิป</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <label className="upload-picker">
          <IonIcon icon={cameraOutline} style={{ fontSize: 32 }} />
          <p>{previewUrl ? 'ถ่าย/เลือกรูปใหม่' : 'ถ่ายรูปหรือเลือกสลิป'}</p>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void handleFile(file);
            }}
          />
        </label>

        {previewUrl && (
          <img src={previewUrl} alt="" style={{ width: '100%', borderRadius: 12, marginTop: 16 }} />
        )}

        {loading && (
          <div className="ion-text-center ion-margin-top">
            <IonSpinner />
            <p>กำลังอ่านข้อมูลจากสลิป…</p>
          </div>
        )}

        {error && (
          <IonText color="danger">
            <p className="ion-margin-top">{error}</p>
          </IonText>
        )}

        {result && (
          <IonList inset className="ion-margin-top">
            <IonItem>
              <IonLabel>ประเภทเอกสาร</IonLabel>
              <IonBadge slot="end">{DOCUMENT_TYPE_LABEL[result.documentType] ?? result.documentType}</IonBadge>
            </IonItem>
            {result.transaction?.amount !== undefined && (
              <IonItem>
                <IonLabel>จำนวนเงิน</IonLabel>
                <IonText slot="end">{result.transaction.amount.toLocaleString('th-TH')} บาท</IonText>
              </IonItem>
            )}
            {result.transaction?.merchant && (
              <IonItem>
                <IonLabel>ร้าน/บุคคล</IonLabel>
                <IonText slot="end">{result.transaction.merchant}</IonText>
              </IonItem>
            )}
            {result.transaction?.occurredAt && (
              <IonItem>
                <IonLabel>วันที่</IonLabel>
                <IonText slot="end">{new Date(result.transaction.occurredAt).toLocaleString('th-TH')}</IonText>
              </IonItem>
            )}
            {result.transaction?.categoryId && (
              <IonItem>
                <IonLabel>หมวดหมู่</IonLabel>
                <IonText slot="end">{categoryLabel(result.transaction.categoryId)}</IonText>
              </IonItem>
            )}
            {result.unclearFields.length > 0 && (
              <IonItem>
                <IonLabel className="ion-text-wrap" color="warning">
                  ต้องตรวจสอบ: {result.unclearFields.join(', ')}
                </IonLabel>
              </IonItem>
            )}
          </IonList>
        )}

        {result && (
          <IonText color="medium">
            <p className="ion-padding-start ion-padding-end">
              ยังบันทึกเป็นรายการจริงไม่ได้ในตอนนี้ — ขั้นตอนถัดไปคือหน้ายืนยัน/บันทึกรายการ
            </p>
          </IonText>
        )}
      </IonContent>
    </IonPage>
  );
};

export default UploadPage;
