import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/noto-sans-thai/400.css';
import '@fontsource/noto-sans-thai/500.css';
import '@fontsource/noto-sans-thai/600.css';
import '@fontsource/noto-sans-thai/700.css';
import App from './App';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import { installGlobalErrorMonitoring } from '@/lib/errorMonitoring';

const container = document.getElementById('root');
const root = createRoot(container!);
installGlobalErrorMonitoring();
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
