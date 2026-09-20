<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Compass, MapLocation, Medal, Odometer, Share } from '@element-plus/icons-vue'
import { prefetchRoute } from '@/router'
import { navItems, platformInfo } from '@/config/nav'
import type { NavItem } from '@/types'

const route = useRoute()
const router = useRouter()

const emit = defineEmits<{ collapse: [] }>()

/**
 * 入口图标：统一用界面同一套单色线性图标，跟随文字颜色变化，
 * 不再使用自带配色的 emoji（多个 emoji 并排会互相抢色）。
 */
const navIcons: Record<string, Component> = {
  growth: Odometer,
  'skill-tree': Share,
  map: MapLocation,
  certification: Medal,
}

/** 按配置里的 group 分组渲染，增删入口只改 src/config/nav.ts */
const groups = computed(() => {
  const buckets = new Map<string, NavItem[]>()
  for (const item of navItems) {
    const name = item.group ?? ''
    const list = buckets.get(name)
    if (list) list.push(item)
    else buckets.set(name, [item])
  }
  return Array.from(buckets, ([name, items]) => ({ name, items }))
})

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
    <div v-for="group in groups" :key="group.name" class="app-nav__group">
      <p v-if="group.name" class="app-nav__group-label">{{ group.name }}</p>
      <ul class="app-nav__list">
        <li v-for="item in group.items" :key="item.key">
          <button
            class="nav-item"
            :class="{ 'is-active': isActive(item.key) }"
            type="button"
            :aria-current="isActive(item.key) ? 'page' : undefined"
            @mouseenter="prefetchRoute(item.path)"
            @focus="prefetchRoute(item.path)"
            @click="go(item.path)"
          >
            <el-icon class="nav-item__icon" :size="18">
              <component :is="navIcons[item.key] ?? Compass" />
            </el-icon>
            <span class="nav-item__label">{{ item.label }}</span>
          </button>
        </li>
      </ul>
    </div>

    <div class="app-nav__foot">
      <p class="app-nav__brand">
        岗位闯关式实训平台
        <span class="num">{{ platformInfo.version }}</span>
      </p>
      <button
        class="nav-collapse"
        type="button"
        title="收起左侧导航"
        aria-label="收起左侧导航"
        @click="emit('collapse')"
      >
        <span aria-hidden="true">«</span>
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
  --side-icon: var(--ink-3);
  --side-hover-bg: var(--surface-2);
  --side-hover-icon: var(--brand-500);
  --side-active-bg: var(--brand-050);
  --side-active-ink: var(--brand-600);
  --side-active-icon: var(--brand-600);
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

.app-nav__group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.app-nav__group-label {
  padding: 0 12px 6px;
  color: var(--side-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.16em;
}

.app-nav__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--side-ink);
  font-family: inherit;
  font-size: 14.5px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.nav-item__icon {
  flex: none;
  color: var(--side-icon);
  transition: color 0.18s ease;
}

.nav-item:hover {
  background: var(--side-hover-bg);
  color: var(--side-ink-strong);
}

.nav-item:hover .nav-item__icon {
  color: var(--side-hover-icon);
}

.nav-item.is-active {
  background: var(--side-active-bg);
  color: var(--side-active-ink);
  font-weight: 700;
}

.nav-item.is-active .nav-item__icon {
  color: var(--side-active-icon);
}

/* 选中项：左侧 3px 主色竖线 */
.nav-item.is-active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 9px;
  bottom: 9px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: linear-gradient(180deg, var(--brand-600), var(--brand-500));
}

/* —— 页脚：平台信息 + 收起导航 —— */
.app-nav__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding: 12px 12px 0;
  border-top: 1px solid var(--side-hairline);
}

.app-nav__brand {
  color: var(--side-muted);
  font-size: 11px;
  line-height: 1.6;
  letter-spacing: 0.06em;
}

.nav-collapse {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface-2);
  color: var(--ink-3);
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.nav-collapse:hover {
  border-color: var(--brand-300);
  background: var(--brand-050);
  color: var(--brand-600);
}
</style>
