import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchPositions, selectPosition } from '@/api/position'
import type { Position } from '@/types'

export const usePositionStore = defineStore('position', () => {
  const positions = ref<Position[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  const currentPosition = computed(() => positions.value.find((item) => item.selected) ?? null)

  /** 成长中心：按已点亮技能数（匹配度）倒序 */
  const rankedPositions = computed(() =>
    [...positions.value].sort((a, b) => b.matchRate - a.matchRate || b.litSkillCount - a.litSkillCount),
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
    loading,
    loaded,
    currentPosition,
    currentPositionId,
    rankedPositions,
    load,
    choose,
  }
})
