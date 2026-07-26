import { lazy, Suspense, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, IonSpinner, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/lib/supabaseClient';
import BiometricLockGuard from '@/components/BiometricLockGuard';
import AppSplashScreen from '@/components/AppSplashScreen';
import PrivacyBlurOverlay from '@/components/PrivacyBlurOverlay';

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

// Pages pushed on top of an already-visible, already-interactive tab bar.
// These used to be static imports (bundled into the main chunk that has to
// parse before the app can even show the login screen) specifically to
// avoid a bounce bug: an earlier attempt at lazy-loading them shared ONE
// Suspense boundary with MainTabs, so suspending on any one of these pages
// unmounted the WHOLE outlet (including the already-mounted tab bar) until
// its chunk fetched, then remounted everything -- a visible flash/bounce
// every time a More-menu item was opened for the first time in a session.
// Fix here is per-route Suspense (see PageFallback below) instead of one
// shared boundary -- each of these can suspend independently without ever
// touching MainTabs's own subtree.
const OverviewPage = lazy(() => import('@/pages/OverviewPage'));
const BudgetPage = lazy(() => import('@/pages/BudgetPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const AccountsPage = lazy(() => import('@/pages/AccountsPage'));
const EditTransactionPage = lazy(() => import('@/pages/EditTransactionPage'));
const DebtFormPage = lazy(() => import('@/pages/DebtFormPage'));
const DebtSimulatePage = lazy(() => import('@/pages/DebtSimulatePage'));
const DebtStrategyPage = lazy(() => import('@/pages/DebtStrategyPage'));
const BudgetEditPage = lazy(() => import('@/pages/BudgetEditPage'));

/** Scoped to a single route's content area, not the full screen -- suspending here must never affect the already-mounted tab bar in a sibling route. */
const PageFallback: React.FC = () => (
  <div className="ion-text-center ion-margin-top"><IonSpinner /></div>
);

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
      <PrivacyBlurOverlay />
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
                  {session ? <Suspense fallback={<PageFallback />}><OverviewPage /></Suspense> : <Redirect to="/login" />}
                </Route>
                <Route exact path="/budget">
                  {session ? <Suspense fallback={<PageFallback />}><BudgetPage /></Suspense> : <Redirect to="/login" />}
                </Route>
                <Route exact path="/settings">
                  {session ? <Suspense fallback={<PageFallback />}><SettingsPage /></Suspense> : <Redirect to="/login" />}
                </Route>
                <Route exact path="/accounts">
                  {session ? <Suspense fallback={<PageFallback />}><AccountsPage /></Suspense> : <Redirect to="/login" />}
                </Route>
                <Route exact path="/transactions/:id/edit">
                  {session ? <Suspense fallback={<PageFallback />}><EditTransactionPage /></Suspense> : <Redirect to="/login" />}
                </Route>
                <Route exact path="/debts/new">
                  {session ? <Suspense fallback={<PageFallback />}><DebtFormPage /></Suspense> : <Redirect to="/login" />}
                </Route>
                <Route exact path="/debts/:id/edit">
                  {session ? <Suspense fallback={<PageFallback />}><DebtFormPage /></Suspense> : <Redirect to="/login" />}
                </Route>
                <Route exact path="/debts/:id/simulate">
                  {session ? <Suspense fallback={<PageFallback />}><DebtSimulatePage /></Suspense> : <Redirect to="/login" />}
                </Route>
                <Route exact path="/debts/strategy">
                  {session ? <Suspense fallback={<PageFallback />}><DebtStrategyPage /></Suspense> : <Redirect to="/login" />}
                </Route>
                <Route exact path="/budget/edit">
                  {session ? <Suspense fallback={<PageFallback />}><BudgetEditPage /></Suspense> : <Redirect to="/login" />}
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
