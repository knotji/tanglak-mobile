import { Redirect, Route } from 'react-router-dom';
import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import { cardOutline, ellipsisHorizontalCircleOutline, scanOutline, todayOutline } from 'ionicons/icons';
import TodayPage from '@/pages/TodayPage';
import TransactionsPage from '@/pages/TransactionsPage';
import UploadPage from '@/pages/UploadPage';
import MorePage from '@/pages/MorePage';

const MainTabs: React.FC = () => (
  <IonTabs>
    <IonRouterOutlet>
      <Route exact path="/tabs/today" component={TodayPage} />
      <Route exact path="/tabs/transactions" component={TransactionsPage} />
      <Route exact path="/tabs/upload" component={UploadPage} />
      <Route exact path="/tabs/more" component={MorePage} />
      <Route exact path="/tabs"><Redirect to="/tabs/today" /></Route>
    </IonRouterOutlet>
    <IonTabBar slot="bottom" className="main-tab-bar">
      <IonTabButton tab="today" href="/tabs/today"><IonIcon icon={todayOutline} /><IonLabel>วันนี้</IonLabel></IonTabButton>
      <IonTabButton tab="transactions" href="/tabs/transactions"><IonIcon icon={cardOutline} /><IonLabel>รายการ</IonLabel></IonTabButton>
      <IonTabButton tab="upload" href="/tabs/upload"><IonIcon icon={scanOutline} /><IonLabel>สแกนสลิป</IonLabel></IonTabButton>
      <IonTabButton tab="more" href="/tabs/more"><IonIcon icon={ellipsisHorizontalCircleOutline} /><IonLabel>เพิ่มเติม</IonLabel></IonTabButton>
    </IonTabBar>
  </IonTabs>
);

export default MainTabs;
