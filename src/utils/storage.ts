/** 登录态持久化：Token 与用户信息写入 localStorage */

const TOKEN_KEY = 'spu.student.token'
const PROFILE_KEY = 'spu.student.profile'
const DRAFT_KEY = 'spu.student.draft'
const CHAT_KEY = 'spu.student.chat'

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 隐私模式下写入失败不影响使用 */
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export const getToken = (): string | null => read<string>(TOKEN_KEY)
export const setToken = (token: string): void => write(TOKEN_KEY, token)

export const getProfile = <T>(): T | null => read<T>(PROFILE_KEY)
export const setProfile = (profile: unknown): void => write(PROFILE_KEY, profile)

export function clearAuth(): void {
  remove(TOKEN_KEY)
  remove(PROFILE_KEY)
}

/** 关卡草稿：与登录态无关，暂存于 localStorage */
export const getDrafts = <T>(): T | null => read<T>(DRAFT_KEY)
export const setDrafts = (drafts: unknown): void => write(DRAFT_KEY, drafts)

export const getChatCache = <T>(): T | null => read<T>(CHAT_KEY)
export const setChatCache = (messages: unknown): void => write(CHAT_KEY, messages)
