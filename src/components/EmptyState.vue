<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
  actionText?: string
}>()

const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div class="empty">
    <span class="empty__icon" aria-hidden="true">{{ icon ?? '🗂️' }}</span>
    <p class="empty__title">{{ title }}</p>
    <p v-if="description" class="empty__desc">{{ description }}</p>
    <el-button v-if="actionText" type="primary" round @click="emit('action')">
      {{ actionText }}
    </el-button>
    <slot />
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 46px 24px;
  text-align: center;
}

.empty__icon {
  font-size: 34px;
  opacity: 0.75;
}

.empty__title {
  font-size: 15px;
  font-weight: 700;
}

.empty__desc {
  max-width: 460px;
  color: var(--ink-2);
  font-size: 13px;
}
</style>
