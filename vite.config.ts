/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base phai khop ten repo khi deploy len GitHub Pages (project site),
// nhung de '/' khi chay dev cho tien.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/gia-pha-viet-nam/' : '/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test-setup.ts', 'src/main.tsx'],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
}));
