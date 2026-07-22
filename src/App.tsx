import { lazy, Suspense, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { supabase } from '@/lib/supabaseClient';
import OverviewPage from '@/pages/OverviewPage';
import BudgetPage from '@/pages/BudgetPage';
import SettingsPage from '@/pages/SettingsPage';
import AccountsPage from '@/pages/AccountsPage';
import EditTransactionPage from '@/pages/EditTransactionPage';
import DebtFormPage from '@/pages/DebtFormPage';
import DebtSimulatePage from '@/pages/DebtSimulatePage';
import DebtStrategyPage from '@/pages/DebtStrategyPage';
import BudgetEditPage from '@/pages/BudgetEditPage';
import BiometricLockGuard from '@/components/BiometricLockGuard';
import AppSplashScreen from '@/components/AppSplashScreen';

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

// Only Login/MainTabs are code-split: they're each behind their own gate
// (checkingSession / the login redirect) so a first-load spinner there
// reads as normal app boot. The pages below are pushed on top of an
// already-visible, already-interactive tab bar -- lazy-loading those was
// splitting off a couple KB each while sharing one Suspense boundary with
// everything else in the outlet. Suspending on any one of them unmounted
// the WHOLE outlet (including the already-mounted MainTabs/tab bar) until
// its chunk fetched, then remounted everything -- the visible "bounce"
// when opening a More-menu item for the first time in a session. Static
// imports here removes the possibility of that boundary ever firing for
// these routes.
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const MainTabs = lazy(() => import('@/components/MainTabs'));

import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Listen for mobile deep links (tanglak://login-callback)
    const listenerHandle = CapApp.addListener('appUrlOpen', async (data) => {
      try {
        await Browser.close().catch(() => {});
        const urlStr = data.url;
        if (urlStr.includes('access_token=') || urlStr.includes('code=')) {
          const rawHash = urlStr.includes('#') ? urlStr.split('#')[1] : '';
          const rawQuery = urlStr.includes('?') ? urlStr.split('?')[1]?.split('#')[0] : '';
          const params = new URLSearchParams(rawHash || rawQuery);

          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          const code = params.get('code');

          if (accessToken && refreshToken) {
            const { data: sData } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sData.session) setSession(sData.session);
          } else if (code) {
            const { data: sData } = await supabase.auth.exchangeCodeForSession(code);
            if (sData.session) setSession(sData.session);
          }
        }
      } catch {
        // Fallback catch
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setCheckingSession(false);
    });

    return () => {
      listener.subscription.unsubscribe();
      void listenerHandle.then((h) => h.remove());
    };
  }, []);

  return (
    <IonApp>
      {checkingSession && <AppSplashScreen message="กำลังเริ่มต้นใช้งานแอป…" />}
      {!checkingSession && (
        <BiometricLockGuard>
          <IonReactRouter>
            <Suspense fallback={<AppSplashScreen message="กำลังโหลดข้อมูล…" />}>
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
                <Route exact path="/transactions/:id/edit">
                  {session ? <EditTransactionPage /> : <Redirect to="/login" />}
                </Route>
                <Route exact path="/debts/new">
                  {session ? <DebtFormPage /> : <Redirect to="/login" />}
                </Route>
                <Route exact path="/debts/:id/edit">
                  {session ? <DebtFormPage /> : <Redirect to="/login" />}
                </Route>
                <Route exact path="/debts/:id/simulate">
                  {session ? <DebtSimulatePage /> : <Redirect to="/login" />}
                </Route>
                <Route exact path="/debts/strategy">
                  {session ? <DebtStrategyPage /> : <Redirect to="/login" />}
                </Route>
                <Route exact path="/budget/edit">
                  {session ? <BudgetEditPage /> : <Redirect to="/login" />}
                </Route>
                <Route exact path="/">
                  <Redirect to={session ? '/tabs/today' : '/login'} />
                </Route>
              </IonRouterOutlet>
            </Suspense>
          </IonReactRouter>
        </BiometricLockGuard>
      )}
    </IonApp>
  );
};

export default App;
