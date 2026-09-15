/** 技能树 */

import { mockRequest } from '@/utils/request'
import { skillSystems } from '@/mock/data'
import type { SkillSystem } from '@/types'

/**
 * 技能点只描述「是什么」：进度不在数据里写死。
 * 项目挂靠技能点（Project.skillIds），技能点进度 = 挂靠项目的平均完成度，
 * 所以技能树里不再有 已激活 / 已精通 / 未解锁 这类状态。
 */
export function fetchSkillSystems(): Promise<SkillSystem[]> {
  return mockRequest({
    resolve: () =>
      skillSystems.map((system) => ({
        ...system,
        nodes: system.nodes.map((node) => ({ ...node })),
      })),
  })
}
