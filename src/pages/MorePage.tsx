import { IonContent, IonIcon, IonPage } from '@ionic/react';
import { cardOutline, settingsOutline, statsChartOutline, walletOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';

interface MenuItem {
  path: string;
  label: string;
  subtitle: string;
  icon: string;
  badgeClass: string;
}

const MENU_ITEMS: MenuItem[] = [
  { path: '/overview', label: 'ภาพรวมการเงิน', subtitle: 'สรุปรายรับ ค่าใช้จ่าย และสภาพคล่องเดือนนี้', icon: statsChartOutline, badgeClass: 'tl-icon-badge--income' },
  { path: '/budget', label: 'วางแผนงบประมาณ', subtitle: 'คุมงบรายจ่ายแยกตามหมวดหมู่', icon: cardOutline, badgeClass: 'tl-icon-badge--transfer' },
  { path: '/accounts', label: 'จัดการบัญชี', subtitle: 'บัญชีธนาคาร บัตร และกระเป๋าเงิน', icon: walletOutline, badgeClass: 'tl-icon-badge--expense' },
  { path: '/settings', label: 'ตั้งค่าระบบ', subtitle: 'จัดการบัญชีผู้ใช้และข้อมูลแอป', icon: settingsOutline, badgeClass: 'tl-icon-badge--expense' },
];

const MorePage: React.FC = () => {
  const history = useHistory();

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <PageHeader title="เพิ่มเติม" subtitle="เมนูและการจัดการระบบ" />
        <div className="tl-menu-grid">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.path}
              type="button"
              className="tl-menu-tile"
              onClick={() => history.push(item.path)}
            >
              <div className={`tl-icon-badge ${item.badgeClass}`}>
                <IonIcon aria-hidden="true" icon={item.icon} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ion-text-color)' }}>{item.label}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--tl-text-secondary)', fontWeight: 500 }}>{item.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default MorePage;
