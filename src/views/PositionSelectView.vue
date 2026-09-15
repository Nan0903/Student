<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import EmptyState from '@/components/EmptyState.vue'
import PositionCard from '@/components/PositionCard.vue'
import { useChatStore } from '@/stores/chat'
import { usePositionStore } from '@/stores/position'
import { useProjectStore } from '@/stores/project'
import { useSkillStore } from '@/stores/skill'
import type { Position, PositionDifficulty } from '@/types'

const router = useRouter()
const positionStore = usePositionStore()
const projectStore = useProjectStore()
const skillStore = useSkillStore()
const chat = useChatStore()

const pickedId = ref('')
const directionFilter = ref('全部方向')
const difficultyFilter = ref<'全部难度' | PositionDifficulty>('全部难度')

const directions = computed(() => [
  '全部方向',
  ...Array.from(new Set(positionStore.positions.map((item) => item.direction))),
])
const difficulties: ('全部难度' | PositionDifficulty)[] = ['全部难度', '较易', '中等', '较难']

/** 解锁条件：至少 1 个基础实训项目全部关卡通过 */
const preconditionMet = computed(() =>
  projectStore.projects.some(
    (project) => project.tier === 'basic' && project.status === 'completed',
  ),
)

const visiblePositions = computed(() =>
  positionStore.rankedPositions.filter((position) => {
    const byDirection =
      directionFilter.value === '全部方向' || position.direction === directionFilter.value
    const byDifficulty =
      difficultyFilter.value === '全部难度' || position.difficulty === difficultyFilter.value
    return byDirection && byDifficulty
  }),
)

const pickedPosition = computed(() => positionStore.positions.find((item) => item.id === pickedId.value))
const isCurrent = computed(() => pickedPosition.value?.selected ?? false)

function pick(position: Position): void {
  pickedId.value = pickedId.value === position.id ? '' : position.id
}

async function confirm(): Promise<void> {
  const target = pickedPosition.value
  if (!target) {
    ElMessage.warning('请先选择一个目标岗位')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认选择「${target.name}」作为目标岗位？切换后原有学习进度会保留，成长中心与关卡地图会同步更新。`,
      '确认选择该岗位',
      { confirmButtonText: '确认选择', cancelButtonText: '取消', type: 'info' },
    )
  } catch {
    return
  }
  await positionStore.choose(target.id)
  ElMessage.success(`已切换到「${target.name}」`)
  await router.push('/growth')
}

onMounted(async () => {
  chat.contextLabel = '岗位选择 · 选择你的目标岗位'
  await Promise.all([positionStore.load(), projectStore.load(), skillStore.load()])
  const current = positionStore.currentPosition
  if (current) pickedId.value = current.id
})
</script>

<template>
  <div class="positions">
    <!-- 未达成前置条件 -->
    <section v-if="!preconditionMet" class="panel">
      <EmptyState
        title="先完成 1 个基础实训项目"
        description="岗位选择需要先完成至少 1 个基础实训项目的全部关卡，完成后这里会解锁岗位推荐与切换。"
        action-text="去完成基础实训"
        @action="router.push('/map')"
      />
    </section>

    <template v-else>
      <!-- 筛选 -->
      <div class="filter panel">
        <div class="filter__row">
          <span class="filter__label">方向</span>
          <div class="filter__tags">
            <button
              v-for="item in directions"
              :key="item"
              class="filter-tag"
              :class="{ 'is-on': directionFilter === item }"
              type="button"
              @click="directionFilter = item"
            >
              {{ item }}
            </button>
          </div>
        </div>
        <div class="filter__row">
          <span class="filter__label">难度</span>
          <div class="filter__tags">
            <button
              v-for="item in difficulties"
              :key="item"
              class="filter-tag"
              :class="{ 'is-on': difficultyFilter === item }"
              type="button"
              @click="difficultyFilter = item"
            >
              {{ item }}
            </button>
          </div>
        </div>
      </div>

      <!-- 岗位网格 -->
      <div v-if="visiblePositions.length" class="grid">
        <PositionCard
          v-for="position in visiblePositions"
          :key="position.id"
          :position="position"
          variant="select"
          pickable
          :picked="pickedId === position.id"
          @pick="pick"
        />
      </div>
      <div v-else class="panel">
        <EmptyState
          title="没有符合条件的岗位"
          description="换个方向或难度试试，也可以直接浏览全部岗位。"
          action-text="重置筛选"
          @action="
            () => {
              directionFilter = '全部方向'
              difficultyFilter = '全部难度'
            }
          "
        />
      </div>

      <!-- 底部操作条 -->
      <footer class="actionbar">
        <div class="actionbar__info">
          <template v-if="pickedPosition">
            已选择 <b>{{ pickedPosition.name }}</b>
            <span v-if="isCurrent" class="actionbar__current">（当前岗位）</span>
          </template>
          <template v-else>还没有选择岗位</template>
        </div>
        <div class="actionbar__buttons">
          <el-button @click="pickedId = ''">取消</el-button>
          <el-button
            type="primary"
            :disabled="!pickedPosition || isCurrent"
            @click="confirm"
          >
            {{ isCurrent ? '当前岗位' : '确认选择' }}
          </el-button>
        </div>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.positions {
  display: flex;
  flex-direction: column;
  padding-bottom: 76px;
}

.filter {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
  margin-bottom: 18px;
}

.filter__row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.filter__label {
  flex: none;
  width: 40px;
  color: var(--ink-3);
  font-size: 12px;
  letter-spacing: 0.08em;
}

.filter__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-tag {
  padding: 5px 14px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface);
  color: var(--ink-2);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.filter-tag:hover {
  border-color: var(--brand-300);
  color: var(--brand-600);
}

.filter-tag.is-on {
  border-color: var(--brand-500);
  background: var(--brand-050);
  color: var(--brand-600);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
}

/* —— 底部操作条 —— */
.actionbar {
  position: fixed;
  bottom: 0;
  left: var(--nav-w);
  right: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  max-width: var(--shell-max);
  margin: 0 auto;
  padding: 14px var(--shell-pad);
  border: 1px solid var(--line);
  border-bottom: 0;
  border-radius: var(--r-lg) var(--r-lg) 0 0;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(10px);
  box-shadow: 0 -8px 26px rgba(18, 60, 120, 0.1);
}

.actionbar__info {
  color: var(--ink-2);
  font-size: 13px;
}

.actionbar__info b {
  color: var(--ink-1);
}

.actionbar__current {
  color: var(--brand-600);
}

.actionbar__buttons {
  display: flex;
  gap: 10px;
}


</style>
