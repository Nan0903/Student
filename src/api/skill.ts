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
  node_code: string
  node_name: string
  description: string | null
  status: string
  progress: number
  project_total: number
  project_done: number
}

interface BackendTreeProgress {
  tree_id: number
  tree_code: string
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

/** 后端技能树编码 → 前端体系 key（教师端新增的体系按 id 兜底） */
const TREE_KEYS: Record<string, string> = {
  OPTICAL_IMAGING: 'optical',
  TRADITIONAL_ALGORITHM: 'algorithm',
  DEEP_LEARNING: 'deeplearning',
  SYSTEM_DEPLOYMENT: 'deployment',
}

/** 体系配色：已知体系固定取色，新增体系按顺序取色 */
const TREE_COLORS: Record<string, string> = {
  OPTICAL_IMAGING: '#35c2ff',
  TRADITIONAL_ALGORITHM: '#8b7cff',
  DEEP_LEARNING: '#ff7ba8',
  SYSTEM_DEPLOYMENT: '#34d399',
}
const FALLBACK_COLORS = ['#35c2ff', '#8b7cff', '#ff7ba8', '#34d399', '#f59e0b', '#22d3ee']

export async function fetchSkillSystems(): Promise<SkillSystem[]> {
  const studentId = requireStudentId()
  const overview = await get<BackendOverview>(`/students/${studentId}/skill-tree-progress`)

  return overview.trees.map((tree, index) => {
    const systemId = TREE_KEYS[tree.tree_code] ?? `tree-${tree.tree_id}`
    return {
      id: systemId,
      name: tree.tree_name,
      color:
        TREE_COLORS[tree.tree_code] ??
        FALLBACK_COLORS[index % FALLBACK_COLORS.length] ??
        '#35c2ff',
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
