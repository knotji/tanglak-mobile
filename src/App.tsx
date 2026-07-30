import { lazy, Suspense, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, IonSpinner, IonToast, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/lib/supabaseClient';
import BiometricLockGuard from '@/components/BiometricLockGuard';
import AppSplashScreen from '@/components/AppSplashScreen';
import PrivacyBlurOverlay from '@/components/PrivacyBlurOverlay';
import { parseAuthCallbackCode } from '@/lib/authCallback';

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
const BudgetEditPage = lazy(() => import('@/pages/BudgetEditPage'));

/** Scoped to a single route's content area, not the full screen -- suspending here must never affect the already-mounted tab bar in a sibling route. */
const PageFallback: React.FC = () => (
  <div className="ion-text-center ion-margin-top"><IonSpinner /></div>
);

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authCallbackError, setAuthCallbackError] = useState('');

  useEffect(() => {
    // Listen for mobile deep links (tanglak://login-callback)
    const listenerHandle = CapApp.addListener('appUrlOpen', async (data) => {
      try {
        const code = parseAuthCallbackCode(data.url);
        await Browser.close().catch(() => {});
        const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error || !sessionData.session) throw error ?? new Error('No session returned');
        setSession(sessionData.session);
        setAuthCallbackError('');
      } catch {
        console.error('[auth-callback] rejected or failed');
        setAuthCallbackError('ลิงก์เข้าสู่ระบบไม่ถูกต้องหรือหมดอายุ กรุณาลองใหม่');
      }
    });

    void supabase.auth.getSession()
      .then(({ data }) => {
        setSession(data.session);
      })
      .catch(() => {
        console.error('[auth-session] failed to restore session');
        setAuthCallbackError('ตรวจสอบสถานะการเข้าสู่ระบบไม่สำเร็จ กรุณาลองเข้าสู่ระบบใหม่');
      })
      .finally(() => setCheckingSession(false));

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
      <IonToast
        isOpen={authCallbackError !== ''}
        message={authCallbackError}
        duration={4000}
        color="danger"
        onDidDismiss={() => setAuthCallbackError('')}
      />
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
