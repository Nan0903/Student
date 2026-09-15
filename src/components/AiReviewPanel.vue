<script setup lang="ts">
import { ref } from 'vue'
import type { AiReview } from '@/types'

const props = defineProps<{
  review: AiReview
  moduleName: string
  projectName?: string
}>()

const emit = defineEmits<{
  back: []
  recheck: [note: string]
  simulate: []
}>()

const note = ref('')

const statusText: Record<AiReview['reviewStatus'], string> = {
  passed: 'AI 已完成本次实训的自动评判',
  pending_recheck: '已提交复评申请，等待教师复审',
  rechecked: '教师已完成复审，结果已回流',
}
</script>

<template>
  <div class="review">
    <header class="review__banner">
      <div
        class="review__ring"
        :style="{ '--percent': review.totalScore }"
        role="img"
        :aria-label="`总分 ${review.totalScore} 分`"
      >
        <div class="review__ring-inner">
          <span class="review__score num">{{ review.totalScore }}</span>
          <span class="review__score-unit">分</span>
        </div>
      </div>
      <div class="review__headline">
        <p class="review__grade">
          <span class="review__grade-badge">{{ review.grade }}</span>
          <span class="review__module">{{ moduleName }}</span>
        </p>
        <p class="review__desc">{{ statusText[review.reviewStatus] }}</p>
        <p v-if="projectName" class="review__project">{{ projectName }}</p>
      </div>
    </header>

    <section class="review__body">
      <h4 class="review__section-title">各维度评分</h4>
      <ul class="review__dimensions">
        <li
          v-for="dimension in review.dimensions"
          :key="dimension.name"
          class="dimension"
          :class="{ 'is-fail': !dimension.passed }"
        >
          <div class="dimension__main">
            <div class="dimension__top">
              <span class="dimension__name">{{ dimension.name }}</span>
              <span class="dimension__state">{{ dimension.passed ? '达标' : '待改进' }}</span>
              <span class="dimension__score num">{{ dimension.score }}</span>
            </div>
            <p class="dimension__reason">{{ dimension.reason }}</p>
          </div>
        </li>
      </ul>

      <div class="review__suggestion">
        <p class="review__suggestion-title">AI 提升建议</p>
        <p class="review__suggestion-text">{{ review.suggestion }}</p>
      </div>

      <div v-if="review.reviewStatus === 'rechecked'" class="review__teacher">
        <p class="review__teacher-title">教师复审结果</p>
        <p class="review__teacher-score">
          复审分数：<span class="num">{{ review.teacherScore }}</span> 分
        </p>
        <p class="review__teacher-comment">{{ review.teacherComment }}</p>
      </div>

      <div v-if="review.reviewStatus === 'passed'" class="review__recheck">
        <el-input
          v-model="note"
          type="textarea"
          :rows="2"
          maxlength="200"
          show-word-limit
          resize="none"
          placeholder="如果对结果有异议，可填写异议说明（选填，≤200 字）后申请教师复评"
        />
      </div>
    </section>

    <footer class="review__foot">
      <el-button @click="emit('back')">返回关卡地图</el-button>
      <el-button
        v-if="review.reviewStatus === 'passed'"
        type="warning"
        @click="emit('recheck', note)"
      >
        申请教师复评
      </el-button>
      <el-button
        v-else-if="review.reviewStatus === 'pending_recheck'"
        type="primary"
        @click="emit('simulate')"
      >
        模拟教师完成复审
      </el-button>
      <el-button v-else type="primary" @click="emit('back')">继续下一关</el-button>
    </footer>
  </div>
</template>

<style scoped>
.review {
  display: flex;
  flex-direction: column;
}

.review__banner {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 24px 26px;
  border-radius: var(--r-md);
  background:
    radial-gradient(120% 140% at 100% 0%, rgba(255, 255, 255, 0.55), transparent 60%),
    linear-gradient(120deg, #fff4e6, #fffaf3);
  border: 1px solid var(--wip-line);
}

.review__ring {
  position: relative;
  display: grid;
  place-items: center;
  width: 108px;
  height: 108px;
  flex: none;
  border-radius: 50%;
  background: conic-gradient(
    from -90deg,
    var(--wip) calc(var(--percent) * 1%),
    rgba(250, 140, 22, 0.16) 0
  );
}

.review__ring-inner {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 2px;
  width: 84px;
  height: 84px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 10px rgba(250, 140, 22, 0.16);
}

.review__ring-inner {
  line-height: 84px;
}

.review__score {
  color: #d46b08;
  font-size: 38px;
  font-weight: 700;
}

.review__score-unit {
  color: #d46b08;
  font-size: 13px;
  font-weight: 600;
}

.review__headline {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.review__grade {
  display: flex;
  align-items: center;
  gap: 10px;
}

.review__grade-badge {
  padding: 2px 12px;
  border-radius: var(--r-chip);
  background: var(--wip);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}

.review__module {
  color: var(--ink-1);
  font-size: 15px;
  font-weight: 700;
}

.review__desc {
  color: var(--ink-2);
  font-size: 13px;
}

.review__project {
  color: var(--ink-3);
  font-size: 12px;
}

.review__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 22px 2px 4px;
}

.review__section-title {
  font-size: 14px;
  font-weight: 700;
}

.review__dimensions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dimension {
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--line-soft);
  border-radius: var(--r-sm);
  background: var(--surface-2);
}

.dimension__state {
  padding: 0 7px;
  border: 1px solid var(--ok-line);
  border-radius: var(--r-chip);
  background: var(--ok-bg);
  color: #2f8a08;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
}

.dimension.is-fail .dimension__state {
  border-color: var(--wip-line);
  background: var(--wip-bg);
  color: #b35c00;
}

.dimension__main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.dimension__top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dimension__name {
  font-size: 13px;
  font-weight: 700;
}

.dimension__score {
  color: var(--wip);
  font-size: 15px;
  font-weight: 700;
}

.dimension__reason {
  color: var(--ink-2);
  font-size: 12.5px;
  line-height: 1.6;
}

.review__suggestion {
  padding: 14px 16px;
  border-left: 3px solid var(--wip);
  border-radius: var(--r-sm);
  background: var(--wip-bg);
}

.review__suggestion-title {
  margin-bottom: 4px;
  color: #b35c00;
  font-size: 13px;
  font-weight: 700;
}

.review__suggestion-text {
  color: #7a4a12;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-line;
}

.review__teacher {
  padding: 14px 16px;
  border: 1px solid var(--ok-line);
  border-radius: var(--r-sm);
  background: var(--ok-bg);
}

.review__teacher-title {
  color: #2f8a08;
  font-size: 13px;
  font-weight: 700;
}

.review__teacher-score {
  margin: 4px 0;
  font-size: 13px;
}

.review__teacher-score .num {
  color: #2f8a08;
  font-size: 18px;
  font-weight: 700;
}

.review__teacher-comment {
  color: #3f6b24;
  font-size: 13px;
  line-height: 1.65;
}

.review__foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 18px;
  margin-top: 6px;
  border-top: 1px solid var(--line-soft);
}
</style>
