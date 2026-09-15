import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchProfile, loginAsStudent, loginAsTeacher, loginWithKey } from '@/api/auth'
import { setCurrentStudentId } from '@/api/session'
import { clearAuth, getProfile, getToken, setProfile, setToken } from '@/utils/storage'
import type { LoginResult, StudentProfile, UserRole } from '@/types'

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(getToken())
  const profile = ref<StudentProfile | null>(getProfile<StudentProfile>())
  const role = ref<UserRole>('student')

  // 刷新页面后把缓存档案里的学生 ID 重新挂给接口层（/students/{id}/... 要用）
  if (profile.value?.id) setCurrentStudentId(profile.value.id)

  const isLoggedIn = computed(() => Boolean(token.value))
  const displayName = computed(() => profile.value?.name ?? '同学')

  function applyResult(result: LoginResult): LoginResult {
    token.value = result.token
    role.value = result.role
    profile.value = result.profile
    if (result.token) setToken(result.token)
    if (result.profile) {
      setProfile(result.profile)
      setCurrentStudentId(result.profile.id)
    }
    return result
  }

  /** 学生端登录（演示链路：按学号取真实档案）/ 教师端只做提示 */
  async function login(loginRole: UserRole): Promise<LoginResult> {
    if (loginRole === 'teacher') return applyResult(await loginAsTeacher())
    return applyResult(await loginAsStudent())
  }

  /** SSO 回调：`?key=xxx` */
  async function loginByKey(key: string): Promise<LoginResult> {
    return applyResult(await loginWithKey(key))
  }

  async function loadProfile(): Promise<void> {
    if (!token.value) return
    profile.value = await fetchProfile()
    setProfile(profile.value)
  }

  function logout(): void {
    token.value = null
    profile.value = null
    clearAuth()
    setCurrentStudentId('')
  }

  return { token, profile, role, isLoggedIn, displayName, login, loginByKey, loadProfile, logout }
})
