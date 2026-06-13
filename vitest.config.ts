import { defineConfig } from 'vitest/config'

// Calc helpers (BMR, MET, nutrient scaling, unit conversion, DRI lookup) are pure
// functions, so the lightweight node environment is sufficient — no jsdom needed.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/utils/**'],
    },
  },
})
