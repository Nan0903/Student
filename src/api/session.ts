/** 当前登录学生（后端主键），接口层用它拼 `/students/{id}/...` 路径 */

import { getProfile } from '@/utils/storage'
import type { StudentProfile } from '@/types'
import { ApiError } from './http'

let currentStudentId = ''

export function setCurrentStudentId(id: string): void {
  currentStudentId = id
}

export function currentStudentIdOrNull(): string {
  if (currentStudentId) return currentStudentId
  const cached = getProfile<StudentProfile>()
  currentStudentId = cached?.id ?? ''
  return currentStudentId
}

/** 取当前学生 ID；没有登录态时按 401 处理 */
export function requireStudentId(): string {
  const id = currentStudentIdOrNull()
  if (!id) throw new ApiError(401, '登录状态已失效，请重新登录')
  return id
}
