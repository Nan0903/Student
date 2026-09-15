<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { platformInfo } from '@/config/nav'
import logoImage from '@/assets/images/logo.png'
import { formatNumber } from '@/utils/format'

defineProps<{ navCollapsed?: boolean }>()
const emit = defineEmits<{ toggleNav: [] }>()

const router = useRouter()
const route = useRoute()
const user = useUserStore()

const profile = computed(() => user.profile)
const initial = computed(() => profile.value?.name.slice(0, 1) ?? '同')

const metrics = computed(() => [
  { key: 'points', label: '累计积分', value: formatNumber(profile.value?.points ?? 0), to: '' },
  { key: 'level', label: '实训等级', value: profile.value?.level ?? '—', to: '' },
  { key: 'rate', label: '完成率', value: `${profile.value?.completionRate ?? 0}%`, to: '/skill-tree' },
])

function goMetric(to: string): void {
  if (to) void router.push(to)
}

/** 退出登录：回到入口选择页（保留当前路径，重新认证后可回到原处） */
async function logout(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '退出后需要重新选择身份入口才能进入学生端。确认退出登录？',
      '退出登录',
      { confirmButtonText: '退出登录', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  const redirect = route.fullPath
  user.logout()
  await router.replace({ path: '/login', query: { redirect } })
}
</script>

<template>
  <header class="app-header">
    <div class="app-header__inner">
      <!-- 左侧导航收起 / 展开 -->
      <button
        class="nav-toggle"
        type="button"
        :aria-expanded="!navCollapsed"
        :title="navCollapsed ? '展开左侧导航' : '收起左侧导航'"
        @click="emit('toggleNav')"
      >
        <span class="nav-toggle__glyph" aria-hidden="true">{{ navCollapsed ? '»' : '«' }}</span>
        <span class="nav-toggle__label">导航</span>
      </button>

      <!-- 校徽 + 校名：像校门口的门牌 -->
      <div class="brand">
        <img class="brand__logo" :src="logoImage" :alt="platformInfo.school" />
        <span class="brand__college">{{ platformInfo.college }} · {{ platformInfo.platform }}</span>
      </div>

      <!-- 学生信息 -->
      <div class="student">
        <span class="student__avatar">{{ initial }}</span>
        <span class="student__meta">
          <span class="student__line">
            <span class="student__name">{{ profile?.name ?? '—' }}</span>
            <span class="student__no num">{{ profile?.studentNo }}</span>
          </span>
          <span class="student__sub">
            {{ profile?.major }} · {{ profile?.className }}
          </span>
        </span>
        <el-popover placement="bottom-start" trigger="hover" :width="240" popper-class="title-popover">
          <template #reference>
            <button class="titles" type="button">
              {{ profile?.titles.length ?? 0 }} 个称号
            </button>
          </template>
          <p class="title-popover__head">已获得称号</p>
          <ul class="title-popover__list">
            <li v-for="title in profile?.titles ?? []" :key="title">
              <span class="title-popover__dot" />
              {{ title }}
            </li>
          </ul>
        </el-popover>
      </div>

      <!-- 三项指标 -->
      <div class="metrics">
        <button
          v-for="metric in metrics"
          :key="metric.key"
          class="metric"
          :class="{ 'metric--link': metric.to }"
          type="button"
          @click="goMetric(metric.to)"
        >
          <span class="metric__label">{{ metric.label }}</span>
          <span class="metric__value num">{{ metric.value }}</span>
        </button>
      </div>

      <!-- 消息 / 待办 / 收藏 -->
      <div class="actions">
        <button class="action" type="button" title="消息">
          消息
          <span class="action__badge num">3</span>
        </button>
        <button class="action" type="button" title="待办">
          待办
          <span class="action__badge num">1</span>
        </button>
        <button class="action" type="button" title="收藏">收藏</button>
        <span class="actions__split" aria-hidden="true" />
        <button class="action" type="button" title="退出登录" @click="logout">退出</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 30;
  width: 100%;
  height: var(--header-h);
  color: var(--ink-inv);
  background:
    radial-gradient(120% 180% at 8% -40%, rgba(255, 255, 255, 0.34), transparent 60%),
    linear-gradient(120deg, var(--brand-600) 0%, var(--brand-500) 58%, #2f8bef 100%);
  box-shadow: 0 8px 24px rgba(18, 82, 160, 0.18);
}

.app-header::after {
  content: "";
  position: absolute;
  inset: auto 0 0;
  height: 1px;
  background: rgba(255, 255, 255, 0.24);
}

.app-header__inner {
  display: flex;
  align-items: center;
  gap: 22px;
  max-width: var(--shell-max);
  height: 100%;
  margin: 0 auto;
  padding: 0 var(--shell-pad);
}

/* —— 校徽 + 校名 —— */
.nav-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  height: 32px;
  padding: 0 11px;
  border: 1px solid rgba(255, 255, 255, 0.26);
  border-radius: var(--r-chip);
  background: rgba(255, 255, 255, 0.1);
  color: var(--ink-inv);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease;
}

.nav-toggle:hover {
  border-color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.22);
}

.nav-toggle__glyph {
  font-size: 15px;
  line-height: 1;
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  min-width: 0;
}

.brand__logo {
  display: block;
  height: 40px;
  width: auto;
}

.brand__college {
  font-size: 12px;
  color: var(--ink-inv-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* —— 学生信息 —— */
.student {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding-left: 22px;
  border-left: 1px solid rgba(255, 255, 255, 0.22);
}

.student__avatar {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 50%;
  background: #fff;
  color: var(--brand-600);
  font-size: 18px;
  font-weight: 700;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.24);
}

.student__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.student__line {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.student__name {
  font-size: 16px;
  font-weight: 700;
}

.student__no {
  font-size: 12px;
  color: var(--ink-inv-2);
}

.student__sub {
  font-size: 12px;
  color: var(--ink-inv-2);
  white-space: nowrap;
}

.titles {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none;
  margin-left: 4px;
  padding: 4px 10px;
  border: 1px solid rgba(255, 255, 255, 0.34);
  border-radius: var(--r-chip);
  background: rgba(255, 255, 255, 0.12);
  color: var(--ink-inv);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s ease;
}

.titles:hover {
  background: rgba(255, 255, 255, 0.24);
}

/* —— 指标读数 —— */
.metrics {
  display: flex;
  align-items: stretch;
  gap: 0;
  margin-left: auto;
  padding: 6px 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--r-sm);
  background: rgba(9, 62, 128, 0.16);
}

.metric {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-width: 92px;
  padding: 4px 16px;
  border: 0;
  border-radius: var(--r-chip);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: default;
  transition: background 0.18s ease;
}

.metric + .metric {
  border-left: 1px solid rgba(255, 255, 255, 0.18);
}

.metric--link {
  cursor: pointer;
}

.metric--link:hover {
  background: rgba(255, 255, 255, 0.16);
}

.metric__label {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--ink-inv-2);
}

.metric__value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}

/* —— 文字入口 —— */
.actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 11px;
  border: 1px solid rgba(255, 255, 255, 0.26);
  border-radius: var(--r-chip);
  background: rgba(255, 255, 255, 0.1);
  color: var(--ink-inv);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease;
}

.action:hover {
  border-color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.22);
}

.action__badge {
  margin-left: 6px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: var(--r-chip);
  background: #ff4d4f;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}

.actions__split {
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: rgba(255, 255, 255, 0.22);
}

@media (max-width: 1440px) {
  .brand__college {
    display: none;
  }
}

@media (max-width: 1280px) {
  .metric {
    min-width: 76px;
    padding: 4px 12px;
  }

  .metric__value {
    font-size: 19px;
  }
}
</style>

<style>
.title-popover__head {
  margin-bottom: 8px;
  color: var(--ink-2);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.title-popover__list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.title-popover__list li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--ink-1);
}

.title-popover__dot {
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 50%;
  background: var(--gold);
}
</style>
