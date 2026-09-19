/** 当前登录学生（后端主键），接口层用它拼 `/students/{id}/...` 路径 */

import { getProfile } from '@/utils/storage'
import type { StudentProfile } from '@/types'
import { ApiError, handleUnauthorized } from './http'

let currentStudentId = ''

export function setCurrentStudentId(id: string): void {
  currentStudentId = id
}

/**
 * 后端学生主键是整型（`sys_user.id`）。
 * 早期 Mock 版本缓存下来的 id 形如 `stu-2023210345`，拼进 `/students/{id}/...`
 * 会被后端判为「Input should be a valid integer」并让所有接口 422；
 * 这类脏登录态直接按未登录处理，交给 401 兜底清登录态并回登录页。
 */
function isValidStudentId(id: string): boolean {
  return /^\d+$/.test(id)
}

export function currentStudentIdOrNull(): string {
  if (currentStudentId && isValidStudentId(currentStudentId)) return currentStudentId
  currentStudentId = ''
  const cached = getProfile<StudentProfile>()
  const cachedId = cached?.id ?? ''
  if (!isValidStudentId(cachedId)) return ''
  currentStudentId = cachedId
  return cachedId
}

/** 取当前学生 ID；没有登录态时按 401 处理 */
export function requireStudentId(): string {
  const id = currentStudentIdOrNull()
  if (!id) {
    handleUnauthorized()
    throw new ApiError(401, '登录状态已失效，请重新登录')
  }
  return id
}
