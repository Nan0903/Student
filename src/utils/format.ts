import type { ModuleStatus, PositionDifficulty, ProjectStatus, ProjectTier } from '@/types'

/** 千分位：顶栏指标必须一读就准 */
export function formatNumber(value: number): string {
  return value.toLocaleString('zh-CN')
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

/** 2026-09-10 → 09-10 */
export function formatShortDate(value: string): string {
  const match = value.match(/(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[2]}-${match[3]}` : value
}

export const tierLabel: Record<ProjectTier, string> = {
  basic: '基础实训',
  advanced: '进阶实训',
  extended: '拓展实训',
}

export const tierSubtitle: Record<ProjectTier, string> = {
  basic: '新手入门 · 掌握核心基础技能',
  advanced: '综合应用 · 解决真实场景难题',
  extended: '产线实战 · 面向交付的完整链路',
}

export const tierOrder: ProjectTier[] = ['basic', 'advanced', 'extended']

export const projectStatusLabel: Record<ProjectStatus, string> = {
  not_started: '可挑战',
  in_progress: '进行中',
  completed: '已完成',
  locked: '未解锁',
}

/** 状态 → 药丸样式类 */
export const projectStatusTone: Record<ProjectStatus, 'todo' | 'wip' | 'done' | 'lock'> = {
  not_started: 'todo',
  in_progress: 'wip',
  completed: 'done',
  locked: 'lock',
}

export const projectStatusIcon: Record<ProjectStatus, string> = {
  not_started: '⚡',
  in_progress: '▶',
  completed: '🏆',
  locked: '🔒',
}

export const moduleStatusLabel: Record<ModuleStatus, string> = {
  draft: '草稿',
  submitted: '待评判',
  passed: '已通过',
  rejected: '未通过',
}

export const difficultyTone: Record<PositionDifficulty, 'todo' | 'wip' | 'lock'> = {
  较易: 'todo',
  中等: 'wip',
  较难: 'lock',
}

/** 颜色变量 → 技能体系取色 */
export const skillStatusLabel = {
  locked: '未解锁',
  active: '已激活',
  mastered: '已精通',
} as const

/** 文件体积展示 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** 生成一个足够唯一的本地 id（Mock 环境） */
export function localId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`
}

export function nowText(): string {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
