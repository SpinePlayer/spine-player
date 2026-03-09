<template>
  <!-- <img :src="imageData" class="image-data" > -->
  <div class="cvs-wrap">
    <!-- <div class="bg"></div> -->
    <canvas ref="canvasRef" class="cvs"></canvas>
    <div ref="followRef" class="follow" :style="followStyle">
      <div class="follow-inner"></div>
    </div>
    <div class="control-group">
      <label>切换动画:</label>
      <select v-model="currentAnimation" @change="onLoopOrAnimationChange">
        <option
          v-for="animation in animations"
          :key="animation"
          :value="animation"
        >
          {{ animation }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { shallowRef, onMounted, reactive, computed } from "vue";
import SpinePlayer, { SpineTools } from "spine-player";
import { ASSETS } from "../config";

const followPosition = reactive({
  x: 0,
  y: 0,
  scaleX: 0,
  scaleY: 0,
  rotation: 0,
});
const followStyle = computed(() => {
  return {
    transform: `
      translate(calc(-50% + ${followPosition.x}px), calc(-50% + ${followPosition.y}px))
      scale(${followPosition.scaleX}, ${followPosition.scaleY})
      rotate(${followPosition.rotation}deg)`,
    // top: `${followPosition.y}px`,
    // left: `${followPosition.x}px`,
    // transform: `scale(${followPosition.scaleX}, ${followPosition.scaleY}) rotate(${followPosition.rotation}deg)`,
  };
});

const imageData = shallowRef<string>("");

imageData.value = SpineTools.getTextImage(
  "测试文字测试文字测试文hh \n字测试文字",
  {
    width: 100,
    height: 60,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    verticalAligin: "center",
    // textBaseline: 'top',
  },
);

const canvasRef = shallowRef<HTMLCanvasElement>();
const currentAnimation = shallowRef<string>("");
const animations = shallowRef<string[]>([]);

let spinePlayer: SpinePlayer | null = null;

async function initSpine() {
  if (!canvasRef.value) return;
  // 创建实例
  spinePlayer = new SpinePlayer(canvasRef.value, {
    // type: 'canvas2d',
    triangleRendering: true,
    background: {
      color: "rgba(255, 0, 0, 0.5)",
    },
    onUpdate: () => {
      // throw new Error('test');
    },
  });
  // 加载动画
  await spinePlayer.loadSpine({
    loop: true,
    autoPlay: true,
    customScale: 1,
    debugMode: true,
    dynamicCalcBound: true,
    renderFirstScreen: true,
    assets: {
      useKTX2: false,
      skel: ASSETS.dragon.skel,
      atlas: ASSETS.dragon.atlas,
      textures: [
        // {
        //   'ceshi1': imageData.value,
        // },
      ],
    },
    // filters: {
    //   type: 'blur',
    //   params: {
    //     blurSize: 10,
    //   },
    // },
  });
  spinePlayer.setTimeScale(0.5);
  // 获取所有动画
  animations.value = [...spinePlayer.getAnimations()];
  currentAnimation.value = spinePlayer.animationName;
  await spinePlayer.loadTexture({
    ceshi1: imageData.value,
  });
  spinePlayer.hackTextureBySlotName("body", "ceshi1", true);
  spinePlayer.hackTextureBySlotName("metaljaw", "ceshi1", true);
  console.log(spinePlayer.skeleton);
  // @ts-ignore
  console.log(spinePlayer.getSlotAttachment("number"));
  console.log(spinePlayer.assetManager.get("ceshi1"));

  // spinePlayer.setBackground({
  //   color: 'rgba(0, 0, 255, 0.5)',
  // }, true);

  // add slot follow listener
  // @ts-ignore
  spinePlayer?.addSlotFollowListener("metaljaw", (position) => {
    // console.log(position);
    followPosition.x = position.x;
    followPosition.y = position.y;
    followPosition.scaleX = position.scaleX;
    followPosition.scaleY = position.scaleY;
    followPosition.rotation = position.rotation;
  });
}

function onLoopOrAnimationChange() {
  if (!spinePlayer) return;
  spinePlayer.playAnimation(currentAnimation.value, true);
  // spinePlayer.hackTextureBySlotName('number', 'ceshi1', {
  //   width: 10,
  //   height: 10,
  // });
}

onMounted(() => {
  initSpine();
});
</script>

<style lang="scss" scoped>
.image-data {
  border: 1px solid red;
}

.cvs-wrap {
  position: relative;
  width: 750px;
  text-align: center;

  .bg {
    width: 750px;
    height: 678px;
    position: absolute;
    top: 0;
    left: 0;
  }

  .cvs {
    position: relative;
    display: block;
    width: 750px;
    height: 678px;
    border: 1px solid red;
    box-sizing: border-box;
    margin: 0 auto;
  }

  .follow {
    position: absolute;
    top: 0px;
    left: 0px;
    width: 200px;
    height: 200px;
    border: 2px solid blue;
    background-color: rgba(0, 0, 255, 0.5);
    box-sizing: border-box;

    .follow-inner {
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      transform: translate(50%, 30%);
    }
  }
}
</style>
