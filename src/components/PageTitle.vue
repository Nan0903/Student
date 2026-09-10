<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  eyebrow?: string
}>()
</script>

<template>
  <div class="page-title">
    <div class="page-title__main">
      <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
      <h1 class="page-title__text">{{ title }}</h1>
      <p v-if="subtitle" class="page-title__sub">{{ subtitle }}</p>
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

.eyebrow {
  font-size: 11px;
}

.page-title__text {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.page-title__sub {
  color: var(--ink-2);
  font-size: 13px;
}

.page-title__extra {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: none;
}
</style>
