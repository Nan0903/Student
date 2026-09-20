<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import EmptyState from '@/components/EmptyState.vue'
import { fetchCertificationOverview } from '@/api/certification'
import { platformInfo } from '@/config/nav'
import logoImage from '@/assets/images/logo.png'
import { useChatStore } from '@/stores/chat'
import { useSkillStore } from '@/stores/skill'
import { useUserStore } from '@/stores/user'
import type { Certification, CertificationOverview, CertificationStatus } from '@/types'

const chat = useChatStore()
const skillStore = useSkillStore()
const user = useUserStore()

const loading = ref(true)
const overview = ref<CertificationOverview | null>(null)
const activeTab = ref<CertificationStatus>('obtained')
const previewVisible = ref(false)
const previewItem = ref<Certification | null>(null)

const tabs: { key: CertificationStatus; label: string }[] = [
  { key: 'obtained', label: '已获得' },
  { key: 'reviewing', label: '审核中' },
  { key: 'not_met', label: '未达标' },
]

const counts = computed(() => {
  const items = overview.value?.items ?? []
  return {
    obtained: items.filter((item) => item.status === 'obtained').length,
    reviewing: items.filter((item) => item.status === 'reviewing').length,
    not_met: items.filter((item) => item.status === 'not_met').length,
  }
})

const visibleItems = computed(
  () => (overview.value?.items ?? []).filter((item) => item.status === activeTab.value),
)

/**
 * 「技能树达标」这一条的进度直接取技能点进度（已学成 = 进度 100% 的技能点数），
 * 避免认证中心与技能树各说各话。
 */
const conditions = computed(() =>
  (overview.value?.conditions ?? []).map((condition) => {
    if (condition.id !== 'cond-skill') return condition
    const done = skillStore.stats.done
    return { ...condition, current: done, done: done >= condition.total }
  }),
)

const maskedNo = computed(() => {
  const no = user.profile?.studentNo ?? ''
  return no.length > 6 ? `${no.slice(0, 4)}****${no.slice(-2)}` : no
})

const systemStats = computed(() =>
  skillStore.systems.map((system) => ({
    name: system.name,
    color: system.color,
    lit: skillStore.systemProgress(system).done,
    total: system.nodes.length,
  })),
)

function openPreview(item: Certification): void {
  previewItem.value = item
  previewVisible.value = true
}

function comingSoon(): void {
  ElMessage.info('技能鉴定书暂未开放下载，当前提供静态预览')
  previewVisible.value = true
  previewItem.value = overview.value?.items[0] ?? null
}

onMounted(async () => {
  chat.contextLabel = '认证中心 · 查看认证条件与证书'
  await Promise.all([
    skillStore.load(),
    (async () => {
      overview.value = await fetchCertificationOverview()
      loading.value = false
    })(),
  ])
})
</script>

<template>
  <div class="certification">
    <!-- 页面标题已去掉，操作按钮保留在顶部工具条里 -->
    <div class="page-toolbar">
      <el-button @click="comingSoon">查看技能鉴定书</el-button>
    </div>

    <!-- 认证条件三卡 -->
    <section class="conditions">
      <template v-if="loading">
        <div v-for="index in 3" :key="index" class="condition-skeleton skeleton" />
      </template>
      <template v-else>
        <article
          v-for="condition in conditions"
          :key="condition.id"
          class="condition"
          :class="[`condition--${condition.tone}`, { 'is-done': condition.done }]"
        >
        <div class="condition__main">
          <p class="condition__name">
            {{ condition.name }}
            <span v-if="condition.done" class="condition__state">已达成</span>
          </p>
          <p class="condition__requirement">{{ condition.requirement }}</p>
          <div class="condition__bar">
            <span
              class="condition__fill"
              :style="{ width: `${Math.round((condition.current / condition.total) * 100)}%` }"
            />
          </div>
        </div>
        <p class="condition__value">
          <span class="num">{{ condition.current }}</span>
          <span class="condition__slash">/</span>
          <span class="num">{{ condition.total }}</span>
          <span class="condition__unit">{{ condition.unit }}</span>
        </p>
        </article>
      </template>
    </section>

    <!-- 证书列表 -->
    <section class="panel">
      <header class="certs__head">
        <div class="tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="tab"
            :class="{ 'is-on': activeTab === tab.key }"
            type="button"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
            <span class="tab__count num">{{ counts[tab.key] }}</span>
          </button>
        </div>
      </header>

      <div class="panel-body">
        <!-- 取数期间先占位：少了这层判断就会在数据到达前闪一下「还没有已获得的证书」 -->
        <div v-if="loading" class="certs-skeleton">
          <div v-for="index in 2" :key="index" class="cert-skeleton skeleton" />
        </div>

        <ul v-else-if="visibleItems.length" class="certs">
          <li v-for="item in visibleItems" :key="item.id" class="cert">
            <div class="cert__main">
              <p class="cert__name">{{ item.positionName }}</p>
              <p class="cert__meta">
                <template v-if="item.obtainedAt">
                  获得时间 <span class="num">{{ item.obtainedAt }}</span>
                </template>
                <template v-else>尚未获得</template>
              </p>
              <ul class="cert__conditions">
                <li
                  v-for="condition in item.conditions"
                  :key="condition.name"
                  :class="{ 'is-done': condition.done }"
                >
                  {{ condition.name }}
                  <span class="num">{{ condition.current }}</span>
                  <span class="cert__slash">/</span>
                  <span class="cert__required num">{{ condition.required }}</span>
                  <span class="cert__state">{{ condition.done ? '已达成' : '未达成' }}</span>
                </li>
              </ul>
            </div>
            <div class="cert__aside">
              <span
                class="pill"
                :class="
                  item.status === 'obtained'
                    ? 'pill--done'
                    : item.status === 'reviewing'
                      ? 'pill--wip'
                      : 'pill--lock'
                "
              >
                {{
                  item.status === 'obtained' ? '已获得' : item.status === 'reviewing' ? '审核中' : '未达标'
                }}
              </span>
              <el-button
                v-if="item.status === 'obtained'"
                text
                type="primary"
                @click="openPreview(item)"
              >
                查看鉴定书
              </el-button>
              <el-button v-else text disabled>查看鉴定书</el-button>
            </div>
          </li>
        </ul>

        <EmptyState
          v-else
          :title="activeTab === 'obtained' ? '还没有已获得的证书' : '该状态下暂无证书'"
          description="完成认证条件后，证书会在教师端审核通过后出现在这里。"
        />
      </div>
    </section>

    <!-- 技能鉴定书静态预览 -->
    <el-dialog v-model="previewVisible" width="560px" align-center>
      <template #header>
        <div class="preview-head">
          <span>技能鉴定书</span>
          <small>预览样式 · 暂不支持下载</small>
        </div>
      </template>

      <div class="diploma">
        <div class="diploma__top">
          <img class="diploma__logo" :src="logoImage" :alt="platformInfo.school" />
          <p class="diploma__org-sub">{{ platformInfo.college }}</p>
        </div>

        <p class="diploma__title">{{ previewItem?.positionName ?? '技能鉴定书' }}</p>

        <dl class="diploma__fields">
          <div>
            <dt>姓名</dt>
            <dd>{{ user.profile?.name }}</dd>
          </div>
          <div>
            <dt>学号</dt>
            <dd class="num">{{ maskedNo }}</dd>
          </div>
          <div>
            <dt>完成率</dt>
            <dd class="num">{{ user.profile?.completionRate }}%</dd>
          </div>
          <div>
            <dt>实训等级</dt>
            <dd>{{ user.profile?.level }}</dd>
          </div>
        </dl>

        <div class="diploma__systems">
          <div v-for="system in systemStats" :key="system.name" class="diploma__system">
            <span class="diploma__system-name">
              <span class="diploma__dot" :style="{ background: system.color }" />
              {{ system.name }}
            </span>
            <span class="diploma__system-value num">{{ system.lit }}/{{ system.total }}</span>
          </div>
        </div>

        <div class="diploma__badges">
          <span v-for="title in user.profile?.titles ?? []" :key="title" class="diploma__badge">
            {{ title }}
          </span>
        </div>

        <div class="diploma__foot">
          <span>认证机构：{{ platformInfo.college }}</span>
          <span class="num">证书编号：SPU-2026-{{ user.profile?.studentNo }}</span>
        </div>
      </div>

      <template #footer>
        <el-button @click="previewVisible = false">关闭</el-button>
        <el-button type="primary" @click="comingSoon">申请发放</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.certification {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* —— 认证条件 —— */
.conditions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.condition-skeleton {
  height: 148px;
  border-radius: var(--r-md);
}

.condition {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--brand-500);
  border-radius: var(--r-md);
  background: var(--surface);
  box-shadow: var(--sh-1);
}

.condition--wip {
  border-left-color: var(--wip);
}

.condition--ok {
  border-left-color: var(--ok);
}

.condition.is-done {
  border-color: var(--ok-line);
  background: linear-gradient(160deg, var(--ok-bg), #fff 65%);
}

.condition__main {
  flex: 1;
  min-width: 0;
}

.condition__name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14.5px;
  font-weight: 700;
}

.condition__state {
  padding: 0 7px;
  border: 1px solid var(--ok-line);
  border-radius: var(--r-chip);
  background: var(--ok-bg);
  color: #2f8a08;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
}

.condition__requirement {
  margin: 4px 0 10px;
  color: var(--ink-2);
  font-size: 12.5px;
  line-height: 1.6;
}

.condition__bar {
  height: 6px;
  overflow: hidden;
  border-radius: var(--r-bar);
  background: var(--line-soft);
}

.condition__fill {
  display: block;
  height: 100%;
  border-radius: var(--r-bar);
  background: linear-gradient(90deg, var(--brand-600), #4aa3ff);
}

.condition--wip .condition__fill {
  background: linear-gradient(90deg, var(--wip), #ffb45c);
}

.condition.is-done .condition__fill {
  background: linear-gradient(90deg, var(--ok), #86e05a);
}

.condition__value {
  display: flex;
  align-items: baseline;
  gap: 2px;
  flex: none;
}

.condition__value .num {
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
}

.condition__slash {
  color: var(--ink-3);
}

.condition__unit {
  margin-left: 4px;
  color: var(--ink-3);
  font-size: 12px;
}

/* —— 页签 —— */
.certs__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 22px;
  border-bottom: 1px solid var(--line-soft);
}

.tabs {
  display: flex;
  gap: 6px;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border: 0;
  border-radius: var(--r-chip);
  background: transparent;
  color: var(--ink-2);
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.tab.is-on {
  background: var(--brand-050);
  color: var(--brand-600);
}

.tab__count {
  font-size: 12px;
}

/* —— 证书列表项 —— */
.certs-skeleton {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cert-skeleton {
  height: 96px;
  border-radius: var(--r-md);
}

.certs {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cert {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--surface);
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.cert:hover {
  border-color: var(--brand-300);
  box-shadow: var(--sh-1);
}

.cert__main {
  flex: 1;
  min-width: 0;
}

.cert__name {
  font-size: 15px;
  font-weight: 700;
}

.cert__meta {
  margin: 3px 0 10px;
  color: var(--ink-3);
  font-size: 12px;
}

.cert__conditions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
}

.cert__conditions li {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--ink-2);
  font-size: 12px;
}

.cert__conditions li.is-done {
  color: #2f8a08;
}

.cert__state {
  color: var(--ink-3);
  font-size: 11px;
}

.cert__conditions li.is-done .cert__state {
  color: #2f8a08;
  font-weight: 600;
}

.cert__slash {
  color: var(--ink-3);
}

.cert__required {
  color: var(--ink-3);
}

.cert__aside {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex: none;
}

/* —— 鉴定书预览 —— */
.preview-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preview-head small {
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 400;
}

.diploma {
  padding: 24px;
  border-radius: var(--r-md);
  background:
    radial-gradient(120% 90% at 88% 0%, rgba(79, 158, 255, 0.32), transparent 58%),
    linear-gradient(150deg, #10233f, #0a1730 70%);
  color: #fff;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);
}

.diploma__top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.diploma__logo {
  display: block;
  height: 34px;
  width: auto;
}

.diploma__org-sub {
  color: rgba(255, 255, 255, 0.62);
  font-size: 11.5px;
  letter-spacing: 0.1em;
}

.diploma__title {
  margin: 18px 0 16px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.diploma__fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.16);
}

.diploma__fields dt {
  color: rgba(255, 255, 255, 0.56);
  font-size: 11px;
  letter-spacing: 0.12em;
}

.diploma__fields dd {
  margin: 2px 0 0;
  font-size: 14px;
  font-weight: 600;
}

.diploma__systems {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  padding: 16px 0;
}

.diploma__system {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12.5px;
}

.diploma__system-name {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: rgba(255, 255, 255, 0.78);
}

.diploma__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.diploma__system-value {
  font-weight: 700;
}

.diploma__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
}

.diploma__badge {
  padding: 3px 11px;
  border: 1px solid rgba(255, 197, 61, 0.5);
  border-radius: var(--r-chip);
  background: rgba(255, 197, 61, 0.14);
  color: #ffd977;
  font-size: 11.5px;
}

.diploma__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.16);
  color: rgba(255, 255, 255, 0.62);
  font-size: 11.5px;
}
</style>
