import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';

const UploadPage: React.FC = () => (
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>สแกนสลิป</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent className="ion-padding">
      <p>อัปโหลด/ถ่ายรูปสลิปเพื่อให้ AI ดึงข้อมูล (ต้องเรียกผ่าน API ฝั่ง server เพราะ extraction ใช้ GEMINI_API_KEY)</p>
    </IonContent>
  </IonPage>
);

export default UploadPage;
