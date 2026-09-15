/**
 * 岗位的查询与选择（对接 training_platform）。
 *
 * 后端只存岗位主数据 + 岗位所需技能；「匹配度 / 已点亮技能数 / 完成项目数」
 * 按当前学生的技能进度与项目记录在前端算出来。
 */

import { get, post, toNumber, type Page } from './http'
import { requireStudentId } from './session'
import type { Position, PositionDifficulty } from '@/types'

interface BackendJob {
  id: number
  job_name: string
  direction_tag: string | null
  recommended_level: string | null
  scene: string | null
  description: string | null
  heat: number
  status: string
}

export interface BackendSkillNode {
  id: number
  node_name: string
}

interface BackendStudentJob {
  job_id: number
  is_primary: boolean
  job_name: string | null
}

interface BackendStudentSkill {
  skill_node_id: number
  progress: string | number
}

interface BackendStudentProject {
  project_id: number
  status: string
}

interface BackendProject {
  id: number
  job_id: number | null
  status: string
}

/** 岗位方向 → 展示用 emoji（后端没有图标字段，按方向标签兜底映射） */
const DIRECTION_ICONS: Record<string, string> = {
  机器视觉: '🔍',
  人工智能: '🧠',
  光学成像: '🔭',
  系统集成: '🛰️',
  数据工程: '🏷️',
  智能装备: '🦾',
}

const DIFFICULTY_BY_LEVEL: Record<string, PositionDifficulty> = {
  BASIC: '较易',
  ADVANCED: '中等',
  EXPANDED: '较难',
}

/** 等级区间文案：按后端 recommended_level 映射 */
const LEVEL_RANGE: Record<string, [string, string]> = {
  BASIC: ['初级', '中级'],
  ADVANCED: ['中级', '高级'],
  EXPANDED: ['高级', '资深'],
}

export async function fetchJobSkills(jobId: number | string): Promise<BackendSkillNode[]> {
  return get<BackendSkillNode[]>(`/jobs/${jobId}/skills`)
}

export async function fetchPositions(): Promise<Position[]> {
  const studentId = requireStudentId()
  const [jobs, myJobs, mySkills, projects, records] = await Promise.all([
    get<Page<BackendJob>>('/jobs', { query: { status: 'ENABLED', page_size: 200 } }),
    get<BackendStudentJob[]>(`/students/${studentId}/jobs`),
    get<BackendStudentSkill[]>(`/students/${studentId}/skills`),
    get<Page<BackendProject>>('/projects', { query: { page_size: 200 } }),
    get<BackendStudentProject[]>(`/students/${studentId}/projects`),
  ])

  const progressByNode = new Map(
    mySkills.map((item) => [item.skill_node_id, toNumber(item.progress)]),
  )
  const primaryJobId = myJobs.find((item) => item.is_primary)?.job_id ?? null
  const completedProjectIds = new Set(
    records.filter((item) => item.status === 'COMPLETED').map((item) => item.project_id),
  )

  const projectsByJob = new Map<number, BackendProject[]>()
  for (const project of projects.items) {
    if (project.job_id === null) continue
    const list = projectsByJob.get(project.job_id) ?? []
    list.push(project)
    projectsByJob.set(project.job_id, list)
  }

  const result: Position[] = []
  for (const job of jobs.items) {
    const nodes = await fetchJobSkills(job.id)
    const progresses = nodes.map((node) => progressByNode.get(node.id) ?? 0)
    const total = nodes.length
    const lit = progresses.filter((value) => value > 0).length
    const matchRate =
      total > 0 ? Math.round(progresses.reduce((sum, value) => sum + value, 0) / total) : 0
    const jobProjects = projectsByJob.get(job.id) ?? []
    const [levelFrom = '初级', levelTo = '中级'] = LEVEL_RANGE[job.recommended_level ?? 'BASIC'] ?? []

    result.push({
      id: String(job.id),
      name: job.job_name,
      icon: DIRECTION_ICONS[job.direction_tag ?? ''] ?? '🎯',
      direction: job.direction_tag ?? '其他方向',
      difficulty: DIFFICULTY_BY_LEVEL[job.recommended_level ?? 'BASIC'] ?? '中等',
      description: job.description ?? job.scene ?? '',
      levelFrom,
      levelTo,
      heat: job.heat,
      // 后端没有「已选人数」聚合接口，先按 0 展示
      selectedCount: 0,
      litSkillCount: lit,
      totalSkillCount: total,
      finishedProjectCount: jobProjects.filter((project) => completedProjectIds.has(project.id))
        .length,
      matchRate,
      selected: job.id === primaryJobId,
    })
  }
  return result
}

/** 确认选择岗位：设为该学生的主岗位（后端会自动清掉原主岗位） */
export async function selectPosition(positionId: string): Promise<Position[]> {
  const studentId = requireStudentId()
  await post(`/students/${studentId}/jobs`, {
    body: { job_id: Number(positionId), is_primary: true },
  })
  return fetchPositions()
}

/** 岗位所需技能节点 id（成长中心的「岗位技能树」抽屉用） */
export async function fetchPositionSkills(positionId: string): Promise<string[]> {
  const nodes = await fetchJobSkills(positionId)
  return nodes.map((node) => String(node.id))
}
