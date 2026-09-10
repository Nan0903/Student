import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { computeStats, fetchSkillSystems, findNode } from '@/api/skill'
import type { SkillNode, SkillSystem } from '@/types'

export const useSkillStore = defineStore('skill', () => {
  const systems = ref<SkillSystem[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  const stats = computed(() => computeStats(systems.value))

  const allNodes = computed<SkillNode[]>(() => systems.value.flatMap((system) => system.nodes))

  /** 每个体系内的点亮进度，用于列底部进度条 */
  function systemProgress(system: SkillSystem) {
    const total = system.nodes.length
    const lit = system.nodes.filter((node) => node.status !== 'locked').length
    return { total, lit, percent: total === 0 ? 0 : Math.round((lit / total) * 100) }
  }

  function getNode(nodeId: string): SkillNode | null {
    return findNode(systems.value, nodeId)
  }

  /** 某岗位相关技能节点（按体系分组） */
  function nodesByProject(projectIds: string[]): SkillNode[] {
    return allNodes.value.filter((node) => node.projectIds.some((id) => projectIds.includes(id)))
  }

  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return
    loading.value = true
    try {
      systems.value = await fetchSkillSystems()
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  return { systems, stats, allNodes, loading, loaded, systemProgress, getNode, nodesByProject, load }
})
