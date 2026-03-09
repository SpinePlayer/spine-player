import { defineConfig } from 'vite'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        vue3: resolve(__dirname, 'src/vue3/index.ts'),
      },
      name: 'SpinePlayer',
      fileName: (format, entryName) => {
        if (entryName === 'vue3') {
          return `vue3/spine-player-vue3.${format}.js`;
        }
        return `spine-player.${format}.js`;
      },
      formats: ['es'] // 只输出 ES 格式
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
  },
  plugins: [
    vue(),
    dts({
      include: ['src/**/*.ts', 'src/**/*.vue'],
      outDir: 'dist/types',
    }),
  ]
})