import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchPositions, selectPosition } from '@/api/position'
import { useProjectStore } from '@/stores/project'
import { useSkillStore } from '@/stores/skill'
import type { Position, PositionProgress, PositionView, SkillNode } from '@/types'

/**
 * 岗位由若干个技能点构成（Position.skillIds），
 * 匹配度 = 这些技能点进度的均值，推荐顺序也按它排。
 */
export const usePositionStore = defineStore('position', () => {
  const positions = ref<Position[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  function progressOf(position: Position): PositionProgress {
    // 后端岗位推荐里已经算好匹配度与技能点/项目完成情况，优先用它
    if (typeof position.percent === 'number') {
      return {
        percent: position.percent,
        skillTotal: position.skillTotal ?? 0,
        skillDone: position.skillDone ?? 0,
        projectTotal: position.projectTotal ?? 0,
        projectDone: position.projectDone ?? 0,
      }
    }
    const skillStore = useSkillStore()
    const projectStore = useProjectStore()

    const nodes = position.skillIds
      .map((id) => skillStore.getNode(id))
      .filter((node): node is SkillNode => node !== null)
    const skills = skillStore.progressOfNodes(nodes)

    const projects = projectStore.projects.filter((project) => project.positionId === position.id)
    const projectDone = projects.filter(
      (project) => projectStore.passedOf(project.id) >= project.levelTotal,
    ).length

    return {
      percent: skills.percent,
      skillTotal: skills.total,
      skillDone: skills.done,
      projectTotal: projects.length,
      projectDone,
    }
  }

  /** 岗位 + 进度画像 */
  const views = computed<PositionView[]>(() =>
    positions.value.map((position) => ({ ...position, ...progressOf(position) })),
  )

  /** 成长中心 / 岗位选择：按技能点进度倒序推荐 */
  const rankedPositions = computed(() =>
    [...views.value].sort(
      (a, b) => b.percent - a.percent || b.skillDone - a.skillDone || a.name.localeCompare(b.name),
    ),
  )

  const currentPosition = computed<PositionView | null>(
    () => views.value.find((item) => item.selected) ?? null,
  )

  const currentPositionId = computed(() => currentPosition.value?.id ?? '')

  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return
    loading.value = true
    try {
      positions.value = await fetchPositions()
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function choose(positionId: string): Promise<void> {
    positions.value = await selectPosition(positionId)
  }

  return {
    positions,
    views,
    loading,
    loaded,
    currentPosition,
    currentPositionId,
    rankedPositions,
    progressOf,
    load,
    choose,
  }
})
