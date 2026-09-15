/**
 * 技能树（对接 training_platform）。
 *
 * 体系与节点来自 `/skill-trees`、`/skill-trees/{id}/nodes`；学生的点亮情况来自
 * `/students/{id}/skills` 的 `progress`（0~100）：0 = 未解锁，1~99 = 点亮中，100 = 已精通。
 * 节点关联的项目由 `/projects/{id}/skills` 反向索引得到。
 */

import { get, toNumber, type Page } from './http'
import { requireStudentId } from './session'
import type { SkillNode, SkillNodeStatus, SkillSystem, SkillTreeStats } from '@/types'

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
  prerequisite_ids?: number[]
}

interface BackendStudentSkill {
  skill_node_id: number
  progress: string | number
}

interface BackendProject {
  id: number
  status: string
}

/** 技能体系配色：已知体系固定取色，教师端新增的体系按顺序取色 */
const TREE_COLORS: Record<string, string> = {
  OPTICAL_IMAGING: '#35c2ff',
  TRADITIONAL_ALGORITHM: '#8b7cff',
  DEEP_LEARNING: '#ff7ba8',
  SYSTEM_DEPLOYMENT: '#34d399',
}
const FALLBACK_COLORS = ['#35c2ff', '#8b7cff', '#ff7ba8', '#34d399', '#f59e0b', '#22d3ee']

/** 节点图标：后端没有图标字段，按节点名关键字兜底映射 */
const NODE_ICONS: [string, string][] = [
  ['光源', '💡'],
  ['镜头', '🔭'],
  ['相机', '🎛️'],
  ['成像', '🔆'],
  ['滤波', '🧽'],
  ['边缘', '✏️'],
  ['形态', '🧩'],
  ['特征', '📏'],
  ['标注', '🏷️'],
  ['数据集', '🗂️'],
  ['CNN', '🧠'],
  ['训练', '🏋️'],
  ['调优', '⚖️'],
  ['Linux', '🐧'],
  ['Docker', '📦'],
  ['服务', '🔌'],
  ['联调', '🛠️'],
]

function nodeIcon(name: string): string {
  const hit = NODE_ICONS.find(([keyword]) => name.includes(keyword))
  return hit?.[1] ?? '⚙️'
}

function nodeStatus(progress: number): SkillNodeStatus {
  if (progress >= 100) return 'mastered'
  return progress > 0 ? 'active' : 'locked'
}

export async function fetchSkillSystems(): Promise<SkillSystem[]> {
  const studentId = requireStudentId()
  const [treePage, mySkills, projects] = await Promise.all([
    get<Page<BackendTree>>('/skill-trees', { query: { status: 'ENABLED', page_size: 200 } }),
    get<BackendStudentSkill[]>(`/students/${studentId}/skills`),
    get<Page<BackendProject>>('/projects', { query: { status: 'PUBLISHED', page_size: 200 } }),
  ])

  // 后端按 id 倒序返回，这里按创建顺序排列（光学成像系 → 传统算法系 → 深度学习系 → 系统部署系）
  const trees = [...treePage.items].sort((left, right) => left.id - right.id)

  const progressByNode = new Map(
    mySkills.map((item) => [item.skill_node_id, toNumber(item.progress)]),
  )

  // 节点 → 关联项目（完成项目即推进该技能）
  const projectSkillLists = await Promise.all(
    projects.items.map((project) => get<BackendNode[]>(`/projects/${project.id}/skills`)),
  )
  const projectsByNode = new Map<number, number[]>()
  projectSkillLists.forEach((nodes, index) => {
    const project = projects.items[index]
    if (!project) return
    for (const node of nodes) {
      const list = projectsByNode.get(node.id) ?? []
      list.push(project.id)
      projectsByNode.set(node.id, list)
    }
  })

  const treeNodes = await Promise.all(
    trees.map((tree) => get<BackendNode[]>(`/skill-trees/${tree.id}/nodes`)),
  )
  const nameById = new Map(treeNodes.flat().map((node) => [node.id, node.node_name]))

  return trees.map((tree, index) => {
    const nodes = treeNodes[index] ?? []
    return {
      id: String(tree.id),
      name: tree.tree_name,
      color:
        TREE_COLORS[tree.tree_code] ??
        FALLBACK_COLORS[index % FALLBACK_COLORS.length] ??
        '#35c2ff',
      nodes: nodes.map((node): SkillNode => {
        const progress = Math.round(progressByNode.get(node.id) ?? 0)
        return {
          id: String(node.id),
          name: node.node_name,
          systemId: String(tree.id),
          icon: nodeIcon(node.node_name),
          status: nodeStatus(progress),
          // 后端只给进度百分比，这里统一按 100 分母展示
          progress: { current: progress, total: 100 },
          description: node.description ?? node.unlock_note ?? '暂无说明',
          prerequisites: (node.prerequisite_ids ?? [])
            .map((id) => nameById.get(id) ?? '')
            .filter((name) => name.length > 0),
          projectIds: (projectsByNode.get(node.id) ?? []).map((id) => String(id)),
        }
      }),
    }
  })
}

/** 统计口径：已激活 = 有进度但未满，已精通 = 进度 100，总数为全部节点 */
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
