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

/** 后端返回的 ISO 时间（2026-09-14T00:31:17.769933）→ 2026-09-14 00:31 */
export function formatDateTime(value: string): string {
  const match = value.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}` : value
}

export const tierLabel: Record<ProjectTier, string> = {
  basic: '基础实训',
  advanced: '进阶实训',
  extended: '拓展实训',
}

export const tierOrder: ProjectTier[] = ['basic', 'advanced', 'extended']

export const projectStatusLabel: Record<ProjectStatus, string> = {
  not_started: '可挑战',
  in_progress: '进行中',
  submitted: '待评审',
  completed: '已完成',
  locked: '未解锁',
}

/** 状态 → 药丸样式类 */
export const projectStatusTone: Record<ProjectStatus, 'todo' | 'wip' | 'done' | 'lock'> = {
  not_started: 'todo',
  in_progress: 'wip',
  submitted: 'wip',
  completed: 'done',
  locked: 'lock',
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
