/** 技能树 */

import { mockRequest } from '@/utils/request'
import { skillSystems } from '@/mock/data'
import type { SkillNode, SkillSystem, SkillTreeStats } from '@/types'

export function fetchSkillSystems(): Promise<SkillSystem[]> {
  return mockRequest({
    resolve: () => skillSystems.map((system) => ({ ...system, nodes: system.nodes.map((n) => ({ ...n })) })),
  })
}

/** 统计口径：已激活 = active，已精通 = mastered，总数为全部节点 */
export function computeStats(systems: SkillSystem[]): SkillTreeStats {
  let active = 0
  let mastered = 0
  let total = 0
  for (const system of systems) {
    for (const node of system.nodes) {
      total += 1
      if (node.status === 'active') active += 1
      if (node.status === 'mastered') mastered += 1
    }
  }
  return { active, mastered, total }
}

export function findNode(systems: SkillSystem[], nodeId: string): SkillNode | null {
  for (const system of systems) {
    const node = system.nodes.find((item) => item.id === nodeId)
    if (node) return node
  }
  return null
}

/** 岗位所需技能：按体系聚合，供成长中心的岗位技能树抽屉使用 */
export function positionSkillGroups(
  systems: SkillSystem[],
  projectIds: string[],
): { system: SkillSystem; nodes: SkillNode[] }[] {
  return systems
    .map((system) => ({
      system,
      nodes: system.nodes.filter((node) => node.projectIds.some((id) => projectIds.includes(id))),
    }))
    .filter((group) => group.nodes.length > 0)
}
