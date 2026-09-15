<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div class="page-title">
    <div class="page-title__main">
      <h1 class="page-title__text">{{ title }}</h1>
    </div>
    <div class="page-title__extra">
      <slot name="extra" />
    </div>
  </div>
</template>

<style scoped>
.page-title {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 20px;
}

.page-title__main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.page-title__text {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.page-title__extra {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: none;
}
</style>
