/** 岗位的查询与选择 */

import { mockRequest } from '@/utils/request'
import { positions } from '@/mock/data'
import type { Position } from '@/types'

export function fetchPositions(): Promise<Position[]> {
  return mockRequest({ resolve: () => positions.map((item) => ({ ...item })) })
}

/** 确认选择岗位：写入当前岗位，返回最新列表 */
export function selectPosition(positionId: string): Promise<Position[]> {
  return mockRequest({
    delay: [300, 600],
    resolve: () => {
      const target = positions.find((item) => item.id === positionId)
      if (!target) {
        throw new Error('岗位不存在')
      }
      for (const item of positions) {
        item.selected = item.id === positionId
      }
      return positions.map((item) => ({ ...item }))
    },
  })
}

/** 岗位所需技能节点 id（用于成长中心的「岗位技能树」抽屉） */
export function fetchPositionSkills(positionId: string): Promise<string[]> {
  return mockRequest({ resolve: () => [positionId] })
}
