/** 登录与身份认证 */

import { mockRequest } from '@/utils/request'
import { studentProfile } from '@/mock/data'
import type { LoginResult, StudentProfile, UserRole } from '@/types'

const TOKEN_PREFIX = 'mock-jwt'

function issueToken(role: UserRole): string {
  return `${TOKEN_PREFIX}.${role}.${Date.now().toString(36)}`
}

/**
 * SSO 回调：用校方返回的 `key` 换 Token 与身份信息。
 * Mock 环境下 key 以 `teacher` 开头即视为教师身份，便于验证「请使用教师端」分支。
 */
export function loginWithKey(key: string): Promise<LoginResult> {
  return mockRequest({
    auth: false,
    resolve: () => {
      const role: UserRole = key.startsWith('teacher') ? 'teacher' : 'student'
      return {
        token: issueToken(role),
        role,
        profile: role === 'student' ? studentProfile : null,
      }
    },
  })
}

/** 模拟统一身份认证：选择学生端 / 教师端入口 */
export function mockLogin(role: UserRole): Promise<LoginResult> {
  return mockRequest({
    auth: false,
    delay: [300, 600],
    resolve: () => ({
      token: issueToken(role),
      role,
      profile: role === 'student' ? studentProfile : null,
    }),
  })
}

export function fetchProfile(): Promise<StudentProfile> {
  return mockRequest({ resolve: () => studentProfile })
}

export function logout(): Promise<void> {
  return mockRequest({ auth: false, delay: [100, 200], resolve: () => undefined })
}
