<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  applyCertificate,
  fetchCertificationOverview,
  fetchIssuedCertificates,
  takeInterview,
} from '@/api/certification'
import type {
  CertificationItem,
  CertificateSkill,
  IssuedCertificate,
} from '@/api/certification'

const loading = ref(true)
const busyId = ref<number | null>(null)
const items = ref<CertificationItem[]>([])
const certificates = ref<IssuedCertificate[]>([])

const selectedJobName = computed(() => {
  const chosen = items.value.find((item) => item.application !== null) ?? items.value[0]
  return chosen?.job_name ?? '未选择职业'
})

function percent(item: CertificationItem): number {
  if (item.skill_total === 0) return 0
  return Math.round((item.skill_done / item.skill_total) * 100)
}

function statusLabel(item: CertificationItem): string {
  const status = item.application?.status
  if (!status) return item.lit ? '可申请' : '未点亮'
  const map: Record<string, string> = {
    PENDING_INTERVIEW: '待 AI 面试',
    UNDER_REVIEW: '待人工审核',
    APPROVED: '已通过',
    REJECTED: '已驳回',
  }
  return map[status] ?? status
}

function statusType(item: CertificationItem): 'success' | 'warning' | 'info' | 'danger' {
  const status = item.application?.status
  if (status === 'APPROVED') return 'success'
  if (status === 'REJECTED') return 'danger'
  if (status === 'UNDER_REVIEW' || status === 'PENDING_INTERVIEW') return 'warning'
  return item.lit ? 'success' : 'info'
}

function skillProgress(skill: CertificateSkill): number {
  return Math.min(100, Math.max(0, Math.round(skill.progress)))
}

async function apply(item: CertificationItem): Promise<void> {
  busyId.value = item.certificate_rule_id
  try {
    await applyCertificate(item.certificate_rule_id)
    ElMessage.success('申请已提交，进入 AI 面试环节')
    await reload()
  } finally {
    busyId.value = null
  }
}

async function interview(item: CertificationItem): Promise<void> {
  if (!item.application) return
  busyId.value = item.certificate_rule_id
  try {
    await takeInterview(item.application.id)
    ElMessage.success('AI 面试通过（本期占位），已进入人工审核')
    await reload()
  } finally {
    busyId.value = null
  }
}

async function reload(): Promise<void> {
  const [overview, issued] = await Promise.all([
    fetchCertificationOverview(),
    fetchIssuedCertificates(),
  ])
  items.value = overview.items
  certificates.value = issued
}

onMounted(async () => {
  try {
    await reload()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="cert-page">
    <div class="page-head">
      <div>
        <p class="page-head__sub">当前目标职业</p>
        <h2 class="page-head__title">{{ selectedJobName }}</h2>
      </div>
    </div>

    <el-empty v-if="!loading && items.length === 0" description="先到成长中心选择目标职业" />

    <div v-else v-loading="loading" class="cert-list">
      <el-card v-for="item in items" :key="item.certificate_rule_id" class="cert-card" shadow="never">
        <div class="cert-card__head">
          <div>
            <p class="cert-card__job">{{ item.job_name }}</p>
            <h3 class="cert-card__name">{{ item.cert_name }}</h3>
          </div>
          <el-tag :type="statusType(item)" effect="light">{{ statusLabel(item) }}</el-tag>
        </div>

        <div class="cert-card__progress">
          <span class="cert-card__progress-label">
            技能点亮 {{ item.skill_done }}/{{ item.skill_total }}
          </span>
          <el-progress :percentage="percent(item)" :stroke-width="10" />
        </div>

        <ul class="skill-list">
          <li
            v-for="skill in item.skills"
            :key="skill.skill_node_id"
            class="skill"
            :class="{ 'is-lit': skill.lit }"
          >
            <span class="skill__dot" />
            <div class="skill__body">
              <div class="skill__title">
                <span>{{ skill.node_name }}</span>
                <span class="skill__percent">{{ skillProgress(skill) }}%</span>
              </div>
              <p v-if="skill.description" class="skill__desc">{{ skill.description }}</p>
            </div>
          </li>
        </ul>

        <div class="cert-card__actions">
          <el-button
            v-if="!item.application && item.lit"
            type="primary"
            round
            :loading="busyId === item.certificate_rule_id"
            @click="apply(item)"
          >
            申请证书
          </el-button>
          <el-button
            v-if="item.application?.status === 'PENDING_INTERVIEW'"
            type="primary"
            round
            :loading="busyId === item.certificate_rule_id"
            @click="interview(item)"
          >
            参加 AI 面试
          </el-button>
          <el-button
            v-if="item.application?.status === 'REJECTED'"
            round
            :loading="busyId === item.certificate_rule_id"
            @click="apply(item)"
          >
            重新申请
          </el-button>
          <p
            v-if="item.application?.status === 'REJECTED' && item.application.review_comment"
            class="cert-card__comment"
          >
            驳回原因：{{ item.application.review_comment }}
          </p>
          <p
            v-else-if="item.application?.status === 'APPROVED' && item.application.review_comment"
            class="cert-card__comment cert-card__comment--ok"
          >
            审核意见：{{ item.application.review_comment }}
          </p>
        </div>
      </el-card>
    </div>

    <section v-if="certificates.length" class="owned">
      <h3 class="owned__title">已获得证书</h3>
      <div class="owned__list">
        <el-card v-for="cert in certificates" :key="cert.id" class="owned__card" shadow="never">
          <p class="owned__name">{{ cert.cert_name }}</p>
          <p class="owned__meta">{{ cert.job_name }} · {{ cert.issue_org_name ?? '人工智能本科学院' }}</p>
          <p class="owned__no">编号：{{ cert.certificate_no }}</p>
        </el-card>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cert-page {
  max-width: 860px;
  margin: 0 auto;
  padding: 16px 16px 40px;
}

.page-head {
  margin-bottom: 16px;
}

.page-head__sub {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.page-head__title {
  margin: 4px 0 0;
  font-size: 22px;
}

.cert-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cert-card__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.cert-card__job {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.cert-card__name {
  margin: 4px 0 0;
  font-size: 17px;
}

.cert-card__progress {
  margin: 14px 0;
}

.cert-card__progress-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.skill-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.skill {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.skill__dot {
  flex: none;
  width: 10px;
  height: 10px;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--el-border-color);
}

.skill.is-lit .skill__dot {
  background: var(--el-color-success);
}

.skill__body {
  flex: 1;
  min-width: 0;
}

.skill__title {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-weight: 600;
}

.skill__percent {
  color: var(--el-text-color-secondary);
  font-weight: 400;
}

.skill__desc {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.cert-card__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}

.cert-card__comment {
  margin: 0;
  color: var(--el-color-danger);
  font-size: 13px;
}

.cert-card__comment--ok {
  color: var(--el-text-color-secondary);
}

.owned {
  margin-top: 28px;
}

.owned__title {
  font-size: 17px;
}

.owned__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.owned__name {
  margin: 0;
  font-weight: 600;
}

.owned__meta,
.owned__no {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>
