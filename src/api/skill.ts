/**
 * 技能树（对接 training_platform）。
 *
 * 口径与前端新模型一致：技能点只描述「是什么」，进度由挂靠项目推导
 * （见 stores/skill.ts 的 progressOf），所以这里只负责取：
 * - `/skill-trees`、`/skill-trees/{id}/nodes`：体系与技能点
 * 技能点 ↔ 项目的关联在 `/projects/{id}/skills`，由 api/project.ts 映射进 `Project.skillIds`。
 */

import { get, type Page } from './http'
import type { SkillNode, SkillSystem } from '@/types'

interface BackendTree {
  id: number
  tree_code: string
  tree_name: string
  description: string | null
  status: string
}

interface BackendNode {
  id: number
  tree_id: number
  node_code: string
  node_name: string
  description: string | null
  unlock_note: string | null
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
  const page = await get<Page<BackendTree>>('/skill-trees', {
    query: { status: 'ENABLED', page_size: 200 },
  })
  // 后端按 id 倒序返回，这里按创建顺序排列（光学成像系 → 传统算法系 → 深度学习系 → 系统部署系）
  const trees = [...page.items].sort((left, right) => left.id - right.id)
  const nodeLists = await Promise.all(
    trees.map((tree) => get<BackendNode[]>(`/skill-trees/${tree.id}/nodes`)),
  )

  return trees.map((tree, index) => ({
    id: TREE_KEYS[tree.tree_code] ?? `tree-${tree.id}`,
    name: tree.tree_name,
    color:
      TREE_COLORS[tree.tree_code] ??
      FALLBACK_COLORS[index % FALLBACK_COLORS.length] ??
      '#35c2ff',
    nodes: (nodeLists[index] ?? []).map(
      (node): SkillNode => ({
        id: String(node.id),
        name: node.node_name,
        systemId: TREE_KEYS[tree.tree_code] ?? `tree-${tree.id}`,
        description: node.description ?? node.unlock_note ?? tree.description ?? '暂无说明',
      }),
    ),
  }))
}
