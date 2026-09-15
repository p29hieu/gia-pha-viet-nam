import { defineConfig } from 'vitest/config';

/**
 * Bộ kiểm thử luật bảo mật Firestore.
 *
 * Tách khỏi cấu hình chính vì nó cần emulator đang chạy và chạy trên Node chứ
 * không phải jsdom. Chạy bằng `pnpm test:rules` — lệnh đó tự bật emulator.
 */
export default defineConfig({
  test: {
    include: ['firebase/**/*.test.ts'],
    environment: 'node',
    globals: true,
    // Lượt chạy đầu phải chờ emulator nạp luật.
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Các test dùng chung một emulator nên không chạy song song được.
    fileParallelism: false,
  },
});
