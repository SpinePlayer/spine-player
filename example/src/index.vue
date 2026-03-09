<template>
  <DemoCard title="Spine 单动画">
    <CommonUse />
  </DemoCard>

  <DemoCard title="Vue3 组件">
    <Vue3Use />
  </DemoCard>

  <DemoCard title="Spine 多动画">
    <MultiUse />
  </DemoCard>
</template>

<script setup lang="ts">
import CommonUse from "./demos/CommonUse.vue";
import Vue3Use from "./demos/Vue3Use.vue";
import MultiUse from "./demos/MultiUse.vue";
import DemoCard from "./components/DemoCard.vue";
</script>

<style lang="scss">
.control-group {
  margin: 32px;
  display: flex;
  align-items: center;
  text-align: left;
  gap: 24px;

  label {
    font-weight: 600;
    min-width: 80px;
    color: #333;
  }

  select {
    padding: 16px 24px;
    border: 4px solid #e0e6ed;
    border-radius: 16px;
    background: white;
    font-size: 28px;
    transition: border-color 0.2s;
  }

  select:focus {
    outline: none;
    border-color: #667eea;
  }
}

button {
  padding: 20px 22px;
  border: none;
  background: linear-gradient(45deg, #667eea, #764ba2);
  color: white;
  border-radius: 16px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  margin: 12px 10px;
}
</style>
