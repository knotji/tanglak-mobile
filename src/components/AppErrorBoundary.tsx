import { Component, type ReactNode } from 'react';
import { reportAppFailure } from '@/lib/errorMonitoring';

interface AppErrorBoundaryState {
  failed: boolean;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(): void {
    void reportAppFailure('react_render_failure');
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          textAlign: 'center',
          background: '#f8fafc',
          color: '#0f172a',
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>แอปมีปัญหาชั่วคราว</h1>
          <p style={{ marginBottom: 20, color: '#64748b' }}>ข้อมูลของคุณยังไม่ถูกลบ กรุณาเปิดแอปใหม่อีกครั้ง</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              border: 0,
              borderRadius: 999,
              padding: '12px 20px',
              background: '#312e81',
              color: '#fff',
              fontWeight: 700,
            }}
          >
            โหลดแอปใหม่
          </button>
        </div>
      </main>
    );
  }
}

export default AppErrorBoundary;
