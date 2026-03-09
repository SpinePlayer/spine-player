import { createApp } from 'vue'
import App from './src/index.vue'
import { SpinePlugins } from 'spine-player';

// 注册插件
SpinePlugins.use({
  reporter: (type, message, data) => {
    console.log(`[Plugin Example] Catched event:`, {
      type,
      message,
      data,
    });
  }
});

const app = createApp(App)

// 动态导入资源
// const spineAssets = import.meta.glob('@/assets/spine/**/*.(png|atlas|json)')
// console.log('Loaded spine assets:', spineAssets)

app.mount('#app')