<template>
  <canvas :style="{ width: '100%', height: '100%' }" ref="cvsEl" />
</template>

<script lang="ts" setup>
import { shallowRef, onMounted, watch, onBeforeUnmount } from 'vue';
import SpinePlayer from '../SpinePlayer';
import type {
  TrackEntry,
  TimeKeeper,
  ISpineProps,
  ISpineConfig,
  SpineEvent,
  SpineInstance,
} from '../type';

const props = withDefaults(defineProps<ISpineProps>(), {
  autoPlay: true,
  assets: () => <ISpineConfig['assets']>{}
})

const cvsEl = shallowRef<HTMLCanvasElement | null>(null);

const emit = defineEmits<{
  beforeload: [];
  loaded: [SpineInstance?];
  complete: [TrackEntry?];
  end: [TrackEntry?];
  event: [SpineEvent?, TrackEntry?];
  update: [TimeKeeper, number?];
  firstdraw: [SpineInstance?];
}>();

/**
 * 初始化player
 */
let player: SpinePlayer | null;
function initPlayer() {
  if (!cvsEl.value || player) return;
  player = new SpinePlayer(cvsEl.value, {
    ...props,
    onUpdate: (time: TimeKeeper, drawCall?: number) => {
      emit('update', time, drawCall);
    },
  })
}

/**
 * 加载spine动画
 */
function loadSpine() {
  if (!player || !props.assets?.skel || !props.assets?.atlas) return;
  player.loadSpine({
    ...props,
    hooks: {
      onBeforeLoad: () => {
        emit('beforeload');
      },
      onLoaded: (arg1) => {
        emit('loaded', arg1);
      },
      onComplete: (arg1) => {
        emit('complete', arg1);
      },
      onEnd: (arg1) => {
        emit('end', arg1);
      },
      onEvent: (arg1, arg2) => {
        emit('event', arg1, arg2);
      },
      onFirstDraw: (arg1) => {
        emit('firstdraw', arg1);
      }
    }
  })
}

/**
 * 暴露组件实例
 */
defineExpose({
  loadSpine,
  getPlayer: () => player,
})

watch(() => props.animationName, (val) => {
  if (player && val) player.playAnimation(val)
})

watch(() => props.loop, (val) => {
  if (player && val !== void 0) {
    player.playAnimation(player.animationName, val)
  }
})

watch(
  [() => props.assets, () => props.filters],
  () => {
    loadSpine();
  },
  { immediate: false } // 不在初始化时执行，避免重复加载
);

onMounted(() => {
  initPlayer();
  loadSpine();
})

onBeforeUnmount(() => {
  if (player) {
    player.dispose();
    player = null;
  }
})
</script>