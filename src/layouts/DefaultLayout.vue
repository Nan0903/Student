<script setup lang="ts">
import { ref, watch } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import AppNav from '@/components/AppNav.vue'
import AiAssistantDock from '@/components/AiAssistantDock.vue'
import { getUiPrefs, setUiPrefs } from '@/utils/storage'

/** 左侧导航是否收起：记住用户的选择 */
const navCollapsed = ref(getUiPrefs()?.navCollapsed ?? false)

watch(navCollapsed, (value) => setUiPrefs({ ...getUiPrefs(), navCollapsed: value }))

function toggleNav(): void {
  navCollapsed.value = !navCollapsed.value
}
</script>

<template>
  <div class="layout" :class="{ 'is-nav-collapsed': navCollapsed }">
    <AppHeader :nav-collapsed="navCollapsed" @toggle-nav="toggleNav" />

    <div class="layout__body">
      <div class="layout__nav">
        <AppNav />
      </div>

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
  transition: grid-template-columns 0.24s ease;
}

/* 收起导航：列宽归零，内容区自动铺满 */
.layout.is-nav-collapsed .layout__body {
  grid-template-columns: 0 minmax(0, 1fr);
}

/**
 * 导航外层只负责裁剪。
 * 用 overflow: clip 而不是 hidden —— 它不会生成滚动容器，导航栏的吸顶不受影响。
 */
.layout__nav {
  min-width: 0;
  overflow: clip;
}

.layout__main {
  min-width: 0;
  padding: 24px var(--shell-pad) 48px;
}
</style>
