import { lazy, Suspense, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonLoading, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { supabase } from '@/lib/supabaseClient';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import './theme/variables.css';

setupIonicReact();

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const MainTabs = lazy(() => import('@/components/MainTabs'));
const OverviewPage = lazy(() => import('@/pages/OverviewPage'));
const BudgetPage = lazy(() => import('@/pages/BudgetPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const AccountsPage = lazy(() => import('@/pages/AccountsPage'));

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setCheckingSession(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <IonApp>
      <IonLoading isOpen={checkingSession} message="กำลังตรวจสอบบัญชี…" />
      {!checkingSession && (
        <IonReactRouter>
          <Suspense fallback={<IonLoading isOpen message="กำลังโหลด…" />}>
            <IonRouterOutlet>
              <Route exact path="/login">
                {session ? <Redirect to="/tabs/today" /> : <LoginPage />}
              </Route>
              <Route path="/tabs">
                {session ? <MainTabs /> : <Redirect to="/login" />}
              </Route>
              <Route exact path="/overview">
                {session ? <OverviewPage /> : <Redirect to="/login" />}
              </Route>
              <Route exact path="/budget">
                {session ? <BudgetPage /> : <Redirect to="/login" />}
              </Route>
              <Route exact path="/settings">
                {session ? <SettingsPage /> : <Redirect to="/login" />}
              </Route>
              <Route exact path="/accounts">
                {session ? <AccountsPage /> : <Redirect to="/login" />}
              </Route>
              <Route exact path="/">
                <Redirect to={session ? '/tabs/today' : '/login'} />
              </Route>
            </IonRouterOutlet>
          </Suspense>
        </IonReactRouter>
      )}
    </IonApp>
  );
};

export default App;
