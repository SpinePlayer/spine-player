<template>
  <div class="performance-monitor">
    <div class="monitor-item">
      <span class="label">FPS:</span>
      <span class="value">{{ fps }}</span>
    </div>
    <div class="monitor-item">
      <span class="label">Draw Calls:</span>
      <span class="value">{{ drawCalls }}</span>
    </div>
    <div class="monitor-item">
      <span class="label">Triangles:</span>
      <span class="value">{{ triangles }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps<{
  gl?: WebGLRenderingContext | null;
}>();

const fps = ref(0);
const drawCalls = ref(0);
const triangles = ref(0);
let frameCount = 0;
let lastTime = performance.now();
let animationFrameId: number;

// 保存原始的 WebGL 方法
let originalDrawElements: Function | null = null;
let originalDrawArrays: Function | null = null;

const initWebGL = (gl: WebGLRenderingContext) => {
  // 保存原始方法
  originalDrawElements = gl.drawElements;
  originalDrawArrays = gl.drawArrays;

  // 重写 drawElements 方法
  gl.drawElements = function (mode: number, count: number, type: number, offset: number) {
    drawCalls.value++;
    triangles.value += count / 3;
    return originalDrawElements?.call(this, mode, count, type, offset);
  };

  // 重写 drawArrays 方法
  gl.drawArrays = function (mode: number, first: number, count: number) {
    drawCalls.value++;
    triangles.value += count / 3;
    return originalDrawArrays?.call(this, mode, first, count);
  };
};

const resetCounters = () => {
  drawCalls.value = 0;
  triangles.value = 0;
};

const calculateMetrics = () => {
  const currentTime = performance.now();
  frameCount++;

  // 每帧重新计数
  resetCounters();

  if (currentTime - lastTime >= 1000) {
    fps.value = Math.round((frameCount * 1000) / (currentTime - lastTime));
    frameCount = 0;
    lastTime = currentTime;
  }

  animationFrameId = requestAnimationFrame(calculateMetrics);
};

// 监听 gl 属性变化
watch(
  () => props.gl,
  (newGl) => {
    if (newGl) {
      initWebGL(newGl);
    }
  },
  { immediate: true },
);

onMounted(() => {
  calculateMetrics();
});

onUnmounted(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  // 恢复原始的 WebGL 方法
  if (props.gl) {
    // @ts-ignore
    props.gl.drawElements = originalDrawElements;
    // @ts-ignore
    props.gl.drawArrays = originalDrawArrays;
  }
});
</script>

<style scoped>
.performance-monitor {
  position: fixed;
  top: 10px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 10px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 14px;
  z-index: 9999;
}

.monitor-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.monitor-item:last-child {
  margin-bottom: 0;
}

.label {
  margin-right: 10px;
  color: #aaa;
}

.value {
  font-weight: bold;
}
</style>
