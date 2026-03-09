<template>
  <div class="player-wrap">
    <v-spine-player
      ref="vPlayer"
      :assets="ASSETS.alien"
      :loop="true"
      :dynamic-calc-bound="true"
      :animation-name="animationName"
      @loaded="onLoaded"
    />
  </div>
  <div class="control-group">
    <label>动画:</label>
    <select v-model="currentAnimation" @change="onPlay">
      <option
        v-for="animation in animations"
        :key="animation"
        :value="animation"
      >
        {{ animation }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { shallowRef, onMounted } from "vue";
import { VSpinePlayer } from "spine-player/vue3";
import { ASSETS } from "../config";

const animationName = shallowRef("");
const vPlayer = shallowRef();
const currentAnimation = shallowRef("");
const animations = shallowRef<string[]>([]);

function onLoaded(player) {
  animations.value = [...player.getAnimations()];
  currentAnimation.value = player.animationName;
}

function onPlay() {
  animationName.value = currentAnimation.value;
}

onMounted(() => {
  const player = vPlayer.value.getPlayer();
  console.log("获取player实例", player);
});
</script>

<style lang="scss" scoped>
.player-wrap {
  display: block;
  width: 750px;
  height: 678px;
  border: 1px solid red;
  box-sizing: border-box;
  margin: 0 auto;
}

.btn-group {
  text-align: center;
}
</style>
