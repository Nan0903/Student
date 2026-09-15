/**
 * 登录与身份认证（对接 training_platform）。
 *
 * 后端目前没有登录 / SSO 接口（README 里明确属于后续阶段），所以这里先用
 * 「按学号查真实学生档案」的演示链路打通：学生端入口 → 演示学号（见 config/env.ts）→
 * 拿到后端 `sys_user.id` 与班级 / 项目进度 → 后续所有请求都挂在这个学生身上。
 *
 * 后端补上鉴权后，只需要替换本文件的 `loginAsStudent`（换成 POST /api/auth/... 拿 token）。
 */

import { DEMO_STUDENT_NO } from '@/config/env'
import { getProfile } from '@/utils/storage'
import { ApiError, get, toNumber, type Page } from './http'
import { setCurrentStudentId } from './session'
import type { LoginResult, StudentProfile } from '@/types'

interface BackendUser {
  id: number
  user_no: string
  real_name: string
  major_name: string | null
  avatar_url: string | null
  user_type: string
}

interface BackendClassInfo {
  id: number
  class_name: string
}

interface BackendClassStudent {
  class_id: number
  class_name: string | null
  user_no: string
}

interface BackendStudentProject {
  project_id: number
  status: string
  completed_score: string | number | null
}

interface BackendProject {
  id: number
  project_level: string
  status: string
}

/** 演示期登录标记：后端还没签发 JWT，这里只表示「前端已通过后端校验拿到身份」 */
function issueToken(userNo: string): string {
  return `demo.${userNo}.${Date.now().toString(36)}`
}

async function findUserByNo(userNo: string): Promise<BackendUser> {
  const page = await get<Page<BackendUser>>('/users', {
    query: { user_type: 'STUDENT', keyword: userNo, page_size: 200 },
  })
  const user = page.items.find((item) => item.user_no === userNo)
  if (!user) throw new ApiError(404, `学号 ${userNo} 不在学生名册里，换一个学号试试`)
  return user
}

/** 学生所在班级：后端没有「按学生查班级」的接口，用花名册反查（班级数量很少） */
async function findClassName(userNo: string): Promise<string> {
  const classes = await get<Page<BackendClassInfo>>('/classes', {
    query: { page_size: 200, status: 'ACTIVE' },
  })
  for (const item of classes.items) {
    const roster = await get<Page<BackendClassStudent>>(`/classes/${item.id}/students`, {
      query: { keyword: userNo, page_size: 1, status: 'ENROLLED' },
    })
    if (roster.total > 0) return item.class_name
  }
  return ''
}

/** 实训等级：按已完成项目的最高层级推断（后端没有独立的学生等级字段） */
function levelLabel(levels: string[]): string {
  if (levels.includes('EXPANDED')) return '拓展实训'
  if (levels.includes('ADVANCED')) return '进阶实训'
  if (levels.includes('BASIC')) return '基础实训'
  return '未定级'
}

async function buildProfile(user: BackendUser): Promise<StudentProfile> {
  const [className, records, projects] = await Promise.all([
    findClassName(user.user_no),
    get<BackendStudentProject[]>(`/students/${user.id}/projects`),
    get<Page<BackendProject>>('/projects', { query: { page_size: 200 } }),
  ])

  const published = projects.items.filter((item) => item.status === 'PUBLISHED')
  const levelById = new Map(published.map((item) => [item.id, item.project_level]))
  const completed = records.filter((item) => item.status === 'COMPLETED')
  const completedLevels = completed
    .map((item) => levelById.get(item.project_id))
    .filter((item): item is string => Boolean(item))

  return {
    id: String(user.id),
    studentNo: user.user_no,
    name: user.real_name,
    avatar: user.real_name.slice(0, 1),
    major: user.major_name ?? '—',
    className: className || '—',
    // 后端没有积分字段：暂用已完成项目的得分合计顶上，顶栏文案同步为「累计得分」
    points: Math.round(completed.reduce((sum, item) => sum + toNumber(item.completed_score), 0)),
    level: levelLabel(completedLevels),
    completionRate: published.length ? Math.round((completed.length / published.length) * 100) : 0,
    // 后端没有称号数据，先留空（顶栏会显示 0 个称号）
    titles: [],
  }
}

/** 学生端登录：按学号取真实档案（默认用演示学号） */
export async function loginAsStudent(userNo: string = DEMO_STUDENT_NO): Promise<LoginResult> {
  const user = await findUserByNo(userNo)
  setCurrentStudentId(String(user.id))
  return { token: issueToken(user.user_no), role: 'student', profile: await buildProfile(user) }
}

/** 教师端入口：学生端不提供教师页面，只返回身份交给页面提示 */
export async function loginAsTeacher(): Promise<LoginResult> {
  return { token: '', role: 'teacher', profile: null }
}

/**
 * SSO 回调 `?key=xxx`。
 *
 * 后端还没有「Key 换身份」的接口，演示阶段把 key 直接当学号用
 * （`?key=2024010102` 即登录该学生）；`teacher*` 开头的 key 视为教师身份。
 */
export async function loginWithKey(key: string): Promise<LoginResult> {
  if (key.startsWith('teacher')) return loginAsTeacher()
  return loginAsStudent(key)
}

/** 刷新当前学生档案（顶栏指标、完成率） */
export async function fetchProfile(): Promise<StudentProfile> {
  const cached = getProfile<StudentProfile>()
  const user = await findUserByNo(cached?.studentNo ?? DEMO_STUDENT_NO)
  setCurrentStudentId(String(user.id))
  return buildProfile(user)
}
