import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchProfile, loginWithKey, mockLogin } from '@/api/auth'
import { clearAuth, getProfile, getToken, setProfile, setToken } from '@/utils/storage'
import type { LoginResult, StudentProfile, UserRole } from '@/types'

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(getToken())
  const profile = ref<StudentProfile | null>(getProfile<StudentProfile>())
  const role = ref<UserRole>('student')

  const isLoggedIn = computed(() => Boolean(token.value))
  const displayName = computed(() => profile.value?.name ?? '同学')

  function applyResult(result: LoginResult): LoginResult {
    token.value = result.token
    role.value = result.role
    profile.value = result.profile
    setToken(result.token)
    if (result.profile) {
      setProfile(result.profile)
    }
    return result
  }

  /** 模拟统一身份认证：学生端 / 教师端 */
  async function login(loginRole: UserRole): Promise<LoginResult> {
    return applyResult(await mockLogin(loginRole))
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
  }

  return { token, profile, role, isLoggedIn, displayName, login, loginByKey, loadProfile, logout }
})
