import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './', // itch.io 등 하위 경로에서도 동작하도록 상대 경로
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600, // Phaser 청크(지연 로딩)
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/simulation/**/*.test.ts'],
    environment: 'node',
  },
});
