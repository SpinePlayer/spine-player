<template>
  <div class="demo-card">
    <div class="demo-card__header">
      <div class="demo-card__title-wrapper">
        <div class="demo-card__title-line"></div>
        <h3 class="demo-card__title">{{ title }}</h3>
      </div>
    </div>
    <div class="demo-card__content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string;
}

defineProps<Props>();
</script>

<style scoped>
.demo-card {
  border-radius: 8px;
  overflow: hidden;
  margin-top: 20px;
  position: relative;
}

.demo-card__header {
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
  position: relative;
}

.demo-card__title-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.demo-card__title-line {
  width: 8px;
  height: 24px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  border-radius: 8px;
  flex-shrink: 0;
}

.demo-card__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
  letter-spacing: 0.025em;
  position: relative;
}

.demo-card__content {
  background: inherit;
  min-height: 100px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .demo-card {
    margin-bottom: 16px;
    border-radius: 6px;
  }
  
  .demo-card__header {
    padding: 14px 16px;
  }
  
  .demo-card__title {
    font-size: 18px;
  }
  
  .demo-card__title-line {
    height: 20px;
  }
}
</style> 