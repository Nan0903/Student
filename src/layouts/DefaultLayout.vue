<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import AppNav from '@/components/AppNav.vue'
import AiAssistantDock from '@/components/AiAssistantDock.vue'
</script>

<template>
  <div class="layout">
    <AppHeader />

    <div class="layout__body">
      <AppNav />

      <main class="layout__main">
        <router-view v-slot="{ Component }">
          <transition name="rise" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <AiAssistantDock />
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.layout__body {
  flex: 1;
  display: grid;
  grid-template-columns: var(--nav-w) minmax(0, 1fr);
  align-items: stretch;
}

.layout__main {
  min-width: 0;
  padding: 24px var(--shell-pad) 48px;
}
</style>
