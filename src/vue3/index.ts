import VSpinePlayer from './VueSpinePlayer.vue';
import type { App } from 'vue';

export * from '../type';

const VSpinePlayerPlugin = {
  install(app: App, options?: { name?: string }) {
    const componentName = options?.name || 'VSpinePlayer';
    app.component(componentName, VSpinePlayer);
  }
};

export { VSpinePlayer, VSpinePlayerPlugin };

export default VSpinePlayer;