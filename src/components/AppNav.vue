<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { prefetchRoute } from '@/router'
import { navItems } from '@/config/nav'

const route = useRoute()
const router = useRouter()

const emit = defineEmits<{ collapse: [] }>()

withDefaults(defineProps<{ collapsed?: boolean }>(), { collapsed: false })

/** 当前高亮项：由路由 meta.nav 决定，子路由高亮其父级入口 */
function isActive(key: string): boolean {
  return route.meta.nav === key
}

function go(path: string): void {
  if (route.path !== path) void router.push(path)
}
</script>

<template>
  <nav class="app-nav" :class="{ 'is-collapsed': collapsed }" aria-label="主导航">
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

    <div class="app-nav__foot">
      <button
        class="nav-collapse"
        type="button"
        :title="collapsed ? '展开左侧导航' : '收起左侧导航'"
        :aria-expanded="!collapsed"
        @click="emit('collapse')"
      >
        <span class="nav-collapse__glyph" aria-hidden="true">{{ collapsed ? '»' : '«' }}</span>
        <span v-if="!collapsed" class="nav-collapse__label">收起导航</span>
      </button>
    </div>
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
  /* 折叠时保持自身宽度，由外层裁掉，避免收缩过程中文字换行抖动 */
  min-width: var(--nav-w);
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
  transition: opacity 0.16s ease;
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
  padding: 12px 0 0;
  border-top: 1px solid var(--side-hairline);
}

/* —— 底部：收起导航 —— */
.nav-collapse {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 34px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface-2);
  color: var(--ink-2);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.nav-collapse:hover {
  border-color: var(--brand-300);
  background: var(--brand-050);
  color: var(--brand-600);
}

.nav-collapse__glyph {
  font-size: 14px;
  line-height: 1;
}

/* —— 收起态：只剩一条窄栏 + 展开按钮 —— */
.app-nav.is-collapsed {
  min-width: var(--nav-w-collapsed);
  align-items: center;
  padding: 20px 6px 18px;
}

.app-nav.is-collapsed .app-nav__list {
  visibility: hidden;
  opacity: 0;
}

.app-nav.is-collapsed .app-nav__foot {
  width: 100%;
  padding-top: 0;
  border-top: 0;
}

.app-nav.is-collapsed .nav-collapse {
  width: 36px;
  height: 36px;
  padding: 0;
}

.app-nav.is-collapsed .nav-collapse__glyph {
  font-size: 16px;
}
</style>
