/// <reference types="vitest" />

import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    port: 5190,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // The remaining >500kB chunk after manualChunks below is @ionic/react's
    // own component runtime (~1.1MB raw / ~240kB gzipped) -- confirmed by
    // splitting it into its own chunk and seeing it's still the one chunk
    // that trips the default 500kB warning. That's the framework itself,
    // not app bloat; raising the limit here just stops re-flagging a cost
    // this app has already paid by choosing Ionic, rather than hiding a
    // real regression (a genuinely new large chunk would still warn).
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Splits vendor code (large, changes rarely) from app code
        // (small, changes on every deploy) so a redeploy doesn't force
        // re-downloading React/Ionic/Supabase every time -- the actual
        // byte count doesn't shrink much (Ionic's component runtime is
        // inherently large and already loads eagerly, since setupIonicReact()
        // has to run before any route), but repeat-visit load time does.
        manualChunks: {
          vendor: ['react', 'react-dom'],
          // react-router-dom lives here, not in vendor, since
          // @ionic/react-router depends on it -- splitting them apart
          // produced a vendor<->ionic circular-chunk warning on every build
          // (Rollup couldn't cleanly order which chunk imports from which).
          ionic: ['@ionic/react', '@ionic/react-router', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})
