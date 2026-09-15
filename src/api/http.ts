/**
 * 真实后端请求层（对接 training_platform）。
 *
 * 后端约定：
 * - 统一响应体 `{ code, data, msg }`：成功 `code=200`，业务失败 **HTTP 200 + code=422**，
 *   未预期异常 `HTTP 500`；提示文案统一取 `msg`。
 * - 分页响应：`{ items, total, page, page_size, pages }`。
 * - 数值列（Decimal）序列化成字符串，如 `"10.0000000000"`，用 `toNumber` 转换。
 */

import { API_BASE_URL } from '@/config/env'
import { clearAuth, getToken } from '@/utils/storage'

export class ApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** 后端统一分页结构 */
export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export type QueryValue = string | number | boolean | undefined | null

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  /** 查询参数，值为 undefined / null / '' 的会被丢掉 */
  query?: Record<string, QueryValue>
  body?: unknown
  /** 是否需要登录态，默认 true（后端暂未校验，仅预留 Authorization 头） */
  auth?: boolean
}

interface Envelope {
  code?: number
  data?: unknown
  msg?: string
}

let redirecting = false

/** 401 兜底：清空登录态并回到登录页 */
function handleUnauthorized(): void {
  clearAuth()
  if (redirecting) return
  redirecting = true
  const target = `${window.location.pathname}${window.location.search}`
  window.setTimeout(() => {
    redirecting = false
    if (window.location.pathname !== '/login') {
      window.location.assign(`/login?redirect=${encodeURIComponent(target)}`)
    } else {
      window.location.reload()
    }
  }, 0)
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = `${API_BASE_URL}${path}`
  if (!query) return url
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    search.append(key, String(value))
  }
  const qs = search.toString()
  return qs ? `${url}?${qs}` : url
}

/** 发起一次请求并拆掉统一响应体外壳，返回 data */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body, auth = true } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (auth && token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(500, '连接后端失败，请确认服务已启动（默认 http://127.0.0.1:8000）')
  }

  let envelope: Envelope | null = null
  try {
    envelope = (await response.json()) as Envelope
  } catch {
    envelope = null
  }

  if (response.status === 401) {
    handleUnauthorized()
    throw new ApiError(401, '登录状态已失效，请重新登录')
  }

  if (!envelope) {
    throw new ApiError(response.status || 500, `服务返回了非 JSON 内容（HTTP ${response.status}）`)
  }

  const code = envelope.code ?? response.status
  if (code !== 200) {
    throw new ApiError(code, envelope.msg || `请求失败（HTTP ${response.status}）`)
  }

  return envelope.data as T
}

export function get<T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
  return request<T>(path, { ...options, method: 'GET' })
}

export function post<T>(path: string, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
  return request<T>(path, { ...options, method: 'POST' })
}

export function patch<T>(path: string, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
  return request<T>(path, { ...options, method: 'PATCH' })
}

export function del<T>(path: string, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
  return request<T>(path, { ...options, method: 'DELETE' })
}

/** Decimal 字符串 / null → number（缺失按 fallback 处理） */
export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}
