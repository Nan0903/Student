/**
 * 请求层：当前由本地 Mock 提供数据，接口签名按真实后端设计。
 *
 * 页面永远通过 src/api/* 取数据；后端就绪后只替换本文件与 src/api 的内部实现。
 * 保留的能力：延迟模拟、失败重试退避、Authorization 注入、401 兜底跳登录。
 */

import { clearAuth, getToken } from './storage'

export class ApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface MockRequestConfig<T> {
  /** 是否需要登录态，默认 true */
  auth?: boolean
  /** 模拟延迟区间，默认 200–500ms */
  delay?: [number, number]
  /** 数据工厂；抛错即视为接口失败 */
  resolve: () => T
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

function randomDelay([min, max]: [number, number]): number {
  return min + Math.random() * (max - min)
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

/** 模拟一次接口调用 */
export async function mockRequest<T>(config: MockRequestConfig<T>): Promise<T> {
  const { auth = true, delay = [200, 500], resolve } = config
  await wait(randomDelay(delay))

  if (auth && !getToken()) {
    handleUnauthorized()
    throw new ApiError(401, '登录状态已失效，请重新登录')
  }

  return resolve()
}

/** 带重试的调用：失败后按退避策略重试，供 AI 问答等容易失败的请求使用 */
export async function withRetry<T>(task: () => Promise<T>, retries = 2, baseDelay = 400): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task()
    } catch (error) {
      lastError = error
      if (attempt < retries) {
        await wait(baseDelay * 2 ** attempt)
      }
    }
  }
  throw lastError instanceof Error ? lastError : new ApiError(500, '请求失败，请稍后重试')
}

/** Token 刷新：占位实现，等后端支持后接入 */
export async function refreshToken(): Promise<string | null> {
  return getToken()
}
