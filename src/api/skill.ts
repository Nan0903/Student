/**
 * 技能树（对接 training_platform 的学生成长视图）。
 *
 * 一个接口拿全：`GET /api/students/{id}/skill-tree-progress`
 * —— 体系、技能点、以及**后端算好的进度**（= 该技能点挂靠项目的完成度均值）。
 * 前端不再自己按项目推算，避免两套口径不一致。
 */

import { get } from './http'
import { requireStudentId } from './session'
import type { SkillNode, SkillSystem } from '@/types'

interface BackendNodeProgress {
  skill_node_id: number
  node_name: string
  description: string | null
  status: string
  progress: number
  project_total: number
  project_done: number
}

interface BackendTreeProgress {
  tree_id: number
  tree_name: string
  description: string | null
  status: string
  total: number
  done: number
  percent: number
  nodes: BackendNodeProgress[]
}

interface BackendOverview {
  student_id: number
  tree_count: number
  total_nodes: number
  done_nodes: number
  overall_percent: number
  trees: BackendTreeProgress[]
}

/**
 * 体系配色：按后端返回顺序取色（后端已按 id 排序，四大体系的颜色因此固定）。
 * 后端的编码列已删除（tree_code），体系 id 直接用 `tree-<id>`，不再依赖编码。
 */
const SYSTEM_COLORS = ['#35c2ff', '#8b7cff', '#ff7ba8', '#34d399', '#f59e0b', '#22d3ee']

export async function fetchSkillSystems(): Promise<SkillSystem[]> {
  const studentId = requireStudentId()
  const overview = await get<BackendOverview>(`/students/${studentId}/skill-tree-progress`)

  return overview.trees.map((tree, index) => {
    const systemId = `tree-${tree.tree_id}`
    return {
      id: systemId,
      name: tree.tree_name,
      color: SYSTEM_COLORS[index % SYSTEM_COLORS.length] ?? '#35c2ff',
      nodes: tree.nodes.map(
        (node): SkillNode => ({
          id: String(node.skill_node_id),
          name: node.node_name,
          systemId,
          description: node.description ?? '暂无说明',
          progress: Math.round(node.progress),
          projectTotal: node.project_total,
          projectDone: node.project_done,
        }),
      ),
    }
  })
}
