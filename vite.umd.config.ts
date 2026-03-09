import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false, // 不清空，保留之前的构建
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'SpinePlayer',
      fileName: () => 'spine-player.umd.js',
      formats: ['umd']
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue'
        }
      }
    },
    sourcemap: false,
    minify: 'terser',
    target: 'es2015'
  }
})