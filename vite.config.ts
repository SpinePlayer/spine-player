import { defineConfig } from 'vite'
import { resolve } from 'path'
import libConfig from './vite.lib.config'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  if (command === 'build') {
    return libConfig;
  }

  return {
    root: 'example',
    server: {
      port: 3000,
      host: 'localhost',
      open: true
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'example/src'),
        'src': resolve(__dirname, 'src'),
        'spine-web-player': resolve(__dirname, 'src')
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler'
        }
      }
    },
    plugins: [vue()]
  }
})