<template>
  <fps-counter :gl="gl" />
  <div ref="container" class="spine-container"></div>
  <label>控制第2个动画</label>
  <div class="control-group">
    <button @click="onPauseAnimation">暂停动画</button>
    <button @click="onHideAnimation">隐藏动画</button>
    <button @click="onResumeAnimation">恢复动画</button>
  </div>
  <div class="control-group">
    <label>动画:</label>
    <select v-model="currentAnimation" @change="onLoopOrAnimationChange">
      <option
        v-for="animation in animations"
        :key="animation"
        :value="animation"
      >
        {{ animation }}
      </option>
    </select>
    <button @click="onStopAllAnimation">停止播放</button>
    <button @click="onStartAllAnimation">开始播放</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import FpsCounter from "../components/FpsCounter.vue";
import { SpineManage, SpineTools } from "spine-web-player";
import { ASSETS } from "../config";

const container = ref<HTMLElement>();

const gl = ref();

const assets = [
  {
    atlasSrc: ASSETS.dragon.atlas,
    jsonSrc: ASSETS.dragon.skel,
  },
  {
    atlasSrc: ASSETS.alien.atlas,
    jsonSrc: ASSETS.alien.skel,
  },
  {
    atlasSrc: ASSETS.spineboy.atlas,
    jsonSrc: ASSETS.spineboy.skel,
  },
];

let manager: SpineManage | null = null;
const spineUUID = ref<string>("");
const currentAnimation = ref<string>("");
const animations = ref<string[]>([]);

function onPauseAnimation() {
  manager?.pause(spineUUID.value);
}

function onResumeAnimation() {
  manager?.resume(spineUUID.value);
}

function onHideAnimation() {
  manager?.hide(spineUUID.value);
}

function onStopAllAnimation() {
  manager?.stop();
}

function onStartAllAnimation() {
  manager?.start();
}

function onLoopOrAnimationChange() {
  manager?.playAnimation(spineUUID.value, {
    loop: true,
    animationName: currentAnimation.value,
  });
}

let followSpineId = "";
async function playSpine(index: number) {
  if (!manager) return;
  const spineId = `spine-${Math.random().toString(36).substr(2, 9)}`;
  await manager.loadSpine({
    uuid: spineId,
    uniBlendMode: true,
    autoPlay: index !== 2,
    zIndex: index === 2 ? 1 : 0,
    renderFirstScreen: true,
    loop: true,
    bound: SpineTools.viewportBound(
      {
        x: 250 * (index % 3),
        y: 250 * Math.floor(index / 3),
        width: 250,
        height: 250,
      },
      750,
    ),
    assets: {
      useKTX2: false,
      skel: assets[index % 3].jsonSrc,
      atlas: assets[index % 3].atlasSrc,
    },
    filters:
      index === 1
        ? {
            type: "grayscale",
            params: {
              grayscaleLight: 1,
            },
          }
        : null,
  });
  gl.value = manager.gl;
  if (index === 0) {
    followSpineId = spineId;
    manager.setZIndex(spineId, 10);
  }
  if (index === 1) {
    spineUUID.value = spineId;
    currentAnimation.value = manager.getAnimationName(spineId);
    animations.value = manager.getAnimations(spineId);
  }
  if (index === 2) {
    // manager.setZIndex(spineId, 1);
    setTimeout(() => {
      // @ts-ignore
      manager.seekToTime(spineId, 3);
    }, 1000);
  }
  if (index === 5) {
    manager.setZIndex(spineId, 9);
    manager.updateBound(spineId, {
      x: 0,
      y: 0,
      width: 250,
      height: 250,
    });
    manager.addSlotFollowListener(spineId, "metaljaw", (position) => {
      manager?.updateBound(followSpineId, {
        x: position.boundX,
        y: position.boundY,
        width: position.scaleX * 80,
        height: position.scaleY * 80,
        anchorX: 0.5,
        anchorY: 0.5,
      });
    });
  }
  // manager.setBackground({
  //   color: 'rgba(0, 0, 255, 0.5)',
  // }, true);
}

onMounted(() => {
  manager = new SpineManage(container.value!, {
    background: {
      color: "rgba(0, 0, 255, 0.5)",
    },
  });
  [...new Array(9)].forEach((_, i) => {
    playSpine(i);
  });
});

onUnmounted(() => {
  // 清理资源
  manager?.disposeAll();
});
</script>

<style scoped>
.spine-container {
  display: block;
  width: 750px;
  height: 678px;
  border: 1px solid red;
  box-sizing: border-box;
}
</style>
