import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchSkillSystems } from '@/api/skill'
import { useProjectStore } from '@/stores/project'
import type { Project, SkillNode, SkillProgress, SkillSystem, SkillTreeStats } from '@/types'

/**
 * 技能点进度口径（全站统一）：
 * 1. 项目挂靠技能点：Project.skillIds —— 一个项目可覆盖多个技能点，一个技能点也可由多个项目共同训练；
 * 2. 技能点进度 = 它挂靠项目的平均完成度（项目完成度取「已通过关卡 / 关卡总数」）；
 * 3. 体系 / 岗位的进度 = 其技能点进度的均值。
 * 所以技能树里没有 已激活 / 已精通 / 未解锁 这类写死的状态，只有进度条。
 */
export const useSkillStore = defineStore('skill', () => {
  const systems = ref<SkillSystem[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  const allNodes = computed<SkillNode[]>(() => systems.value.flatMap((system) => system.nodes))

  const nodeById = computed(() => new Map(allNodes.value.map((node) => [node.id, node])))

  function getNode(nodeId: string): SkillNode | null {
    return nodeById.value.get(nodeId) ?? null
  }

  /** 技能点 → 挂靠的项目 */
  function projectsOfNode(nodeId: string): Project[] {
    return useProjectStore().projects.filter((project) => project.skillIds.includes(nodeId))
  }

  /** 项目 → 挂靠的技能点 */
  function nodesOfProject(projectId: string): SkillNode[] {
    const project = useProjectStore().getProject(projectId)
    if (!project) return []
    return project.skillIds
      .map((id) => nodeById.value.get(id))
      .filter((node): node is SkillNode => Boolean(node))
  }

  /** 单个项目的完成度 0-100 */
  function projectPercent(project: Project): number {
    const passed = useProjectStore().passedOf(project.id)
    if (!project.levelTotal) return 0
    return Math.min(100, (passed / project.levelTotal) * 100)
  }

  /** 单个技能点的进度：挂靠项目的平均完成度 */
  function progressOf(node: SkillNode): SkillProgress {
    const projects = projectsOfNode(node.id)
    if (!projects.length) return { percent: 0, projectTotal: 0, projectDone: 0 }
    let sum = 0
    let done = 0
    for (const project of projects) {
      const percent = projectPercent(project)
      sum += percent
      if (percent >= 100) done += 1
    }
    return {
      percent: Math.round(sum / projects.length),
      projectTotal: projects.length,
      projectDone: done,
    }
  }

  /** 一组技能点的整体进度：体系进度、岗位匹配度共用这一套口径 */
  function progressOfNodes(nodes: SkillNode[]): SkillTreeStats {
    if (!nodes.length) return { total: 0, done: 0, percent: 0 }
    let sum = 0
    let done = 0
    for (const node of nodes) {
      const percent = progressOf(node).percent
      sum += percent
      if (percent >= 100) done += 1
    }
    return { total: nodes.length, done, percent: Math.round(sum / nodes.length) }
  }

  /** 全部技能点的整体进度（技能树右上角统计面板） */
  const stats = computed(() => progressOfNodes(allNodes.value))

  function systemProgress(system: SkillSystem): SkillTreeStats {
    return progressOfNodes(system.nodes)
  }

  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return
    loading.value = true
    try {
      // 技能点进度由项目推导，这里一并把项目数据拉起来，避免进度全为 0
      const [systemList] = await Promise.all([
        fetchSkillSystems(),
        useProjectStore().load(force),
      ])
      systems.value = systemList
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  return {
    systems,
    stats,
    allNodes,
    loading,
    loaded,
    getNode,
    projectsOfNode,
    nodesOfProject,
    projectPercent,
    progressOf,
    progressOfNodes,
    systemProgress,
    load,
  }
})
