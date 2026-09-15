<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { prefetchRoute } from '@/router'
import { navItems, platformInfo } from '@/config/nav'

const route = useRoute()
const router = useRouter()

/** 当前高亮项：由路由 meta.nav 决定，子路由高亮其父级入口 */
function isActive(key: string): boolean {
  return route.meta.nav === key
}

function go(path: string): void {
  if (route.path !== path) void router.push(path)
}
</script>

<template>
  <nav class="app-nav" aria-label="主导航">
    <ul class="app-nav__list">
      <li v-for="item in navItems" :key="item.key">
        <button
          class="nav-item"
          :class="{ 'is-active': isActive(item.key) }"
          type="button"
          :aria-current="isActive(item.key) ? 'page' : undefined"
          @mouseenter="prefetchRoute(item.path)"
          @focus="prefetchRoute(item.path)"
          @click="go(item.path)"
        >
          <span class="nav-item__label">{{ item.label }}</span>
        </button>
      </li>
    </ul>

    <p class="app-nav__foot">
      岗位闯关式实训平台
      <span class="num">{{ platformInfo.version }}</span>
    </p>
  </nav>
</template>

<style scoped>
/**
 * 侧栏配色：统一收在这组变量里，换肤只改这里，不用动下面的选择器。
 */
.app-nav {
  --side-bg: var(--surface);
  --side-line: var(--line);
  --side-ink: var(--ink-2);
  --side-ink-strong: var(--ink-1);
  --side-hover-bg: var(--surface-2);
  --side-active-bg: var(--brand-050);
  --side-active-ink: var(--brand-600);
  --side-muted: var(--ink-2);
  --side-hairline: var(--line-soft);

  position: sticky;
  top: var(--header-h);
  display: flex;
  flex-direction: column;
  gap: 18px;
  height: calc(100vh - var(--header-h));
  padding: 20px 12px 18px;
  background: var(--side-bg);
  border-right: 1px solid var(--side-line);
  overflow-y: auto;
}

.app-nav__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--side-ink);
  font-family: inherit;
  font-size: 14.5px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.nav-item:hover {
  background: var(--side-hover-bg);
  color: var(--side-ink-strong);
}

.nav-item.is-active {
  background: var(--side-active-bg);
  color: var(--side-active-ink);
  font-weight: 700;
}

/* 选中项：左侧 3px 主色竖线 */
.nav-item.is-active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 9px;
  bottom: 9px;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: linear-gradient(180deg, var(--brand-600), var(--brand-500));
}

.app-nav__foot {
  margin-top: auto;
  padding: 12px 12px 0;
  border-top: 1px solid var(--side-hairline);
  color: var(--side-muted);
  font-size: 11px;
  line-height: 1.6;
  letter-spacing: 0.06em;
}
</style>
