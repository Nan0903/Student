/**
 * AI 助教问答（对接 training_platform 的 /qa 接口）。
 *
 * - 会话：`POST/GET /qa/sessions`，前端只负责「进来时确保有一个可用会话」
 * - 提问：`POST /qa/sessions/{id}/ask`，默认 SSE 流式（meta → delta* → done / error），
 *   失败可退回 `stream=false` 一次性返回
 * - 用量：`GET /qa/usage`（后端只统计不限制）
 */

import { API_BASE_URL } from '@/config/env'
import { getToken } from '@/utils/storage'
import { ApiError, get, post, type Page } from './http'
import { requireStudentId } from './session'

export interface QaMessage {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  status: string
  createdAt: string
}

export interface QaUsage {
  retentionDays: number
  today: { questionCount: number; totalTokens: number }
  recent: { questionCount: number; totalTokens: number }
}

interface BackendSession {
  id: number
  title: string | null
  status: string
  updated_at: string
}

interface BackendMessage {
  id: number
  role: string
  content: string
  status: string
  created_at: string
}

interface BackendSessionDetail extends BackendSession {
  messages: BackendMessage[]
}

interface BackendUsage {
  retention_days: number
  today: { question_count: number; total_tokens: number }
  recent: { question_count: number; total_tokens: number }
}

interface SseFrame {
  event: string
  data: { text?: string; msg?: string; code?: string } | null
}

function toQaMessage(row: BackendMessage): QaMessage {
  return {
    id: String(row.id),
    role: row.role === 'USER' ? 'USER' : 'ASSISTANT',
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
  }
}

/** 新建会话 */
export async function createSession(title = 'AI 助教'): Promise<string> {
  const studentId = requireStudentId()
  const row = await post<BackendSession>('/qa/sessions', {
    body: { student_id: Number(studentId), title },
  })
  return String(row.id)
}

/** 拿最近一个还在用的会话；没有就新建（后端按保留期过滤，过期的会话不会返回） */
export async function ensureSession(): Promise<string> {
  const studentId = requireStudentId()
  const page = await get<Page<BackendSession>>('/qa/sessions', {
    query: { student_id: studentId, page_size: 20 },
  })
  const active = page.items.find((item) => item.status === 'ACTIVE')
  if (active) return String(active.id)
  return createSession()
}

/** 会话最近的消息（后端按时间正序返回） */
export async function fetchMessages(sessionId: string, limit = 30): Promise<QaMessage[]> {
  const studentId = requireStudentId()
  const detail = await get<BackendSessionDetail>(`/qa/sessions/${sessionId}`, {
    query: { student_id: studentId, message_limit: limit },
  })
  return (detail.messages ?? []).map(toQaMessage)
}

/** token / 提问次数用量（当日 + 保留期内） */
export async function fetchUsage(): Promise<QaUsage> {
  const studentId = requireStudentId()
  const usage = await get<BackendUsage>('/qa/usage', { query: { student_id: studentId } })
  return {
    retentionDays: usage.retention_days,
    today: {
      questionCount: usage.today.question_count,
      totalTokens: usage.today.total_tokens,
    },
    recent: {
      questionCount: usage.recent.question_count,
      totalTokens: usage.recent.total_tokens,
    },
  }
}

/** 解析一帧 SSE（`event:` + `data:` 两行） */
function parseFrame(frame: string): SseFrame {
  let event = 'message'
  const dataLines: string[] = []
  for (const rawLine of frame.split('\n')) {
    const line = rawLine.trimEnd()
    if (!line || line.startsWith(':')) continue
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  let data: SseFrame['data'] = null
  if (dataLines.length > 0) {
    try {
      data = JSON.parse(dataLines.join('\n')) as SseFrame['data']
    } catch {
      data = null
    }
  }
  return { event, data }
}

/** 流式提问：边收边回调，返回完整回答 */
export async function askStream(
  sessionId: string,
  question: string,
  onDelta: (text: string) => void,
): Promise<string> {
  const studentId = requireStudentId()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/qa/sessions/${sessionId}/ask`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ student_id: Number(studentId), question, stream: true }),
    })
  } catch {
    throw new ApiError(500, '连接后端失败，请确认服务已启动')
  }
  if (!response.ok || !response.body) {
    throw new ApiError(response.status, `提问失败（HTTP ${response.status}）`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let failure: string | null = null

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let index = buffer.indexOf('\n\n')
    while (index >= 0) {
      const frame = buffer.slice(0, index)
      buffer = buffer.slice(index + 2)
      const { event, data } = parseFrame(frame)
      if (event === 'delta') {
        const text = data?.text ?? ''
        if (text) {
          content += text
          onDelta(text)
        }
      } else if (event === 'error') {
        // 后端明确回了失败原因（配置缺失、模型报错…）：这是业务错误，不要再重发一次
        failure = data?.msg ?? 'AI 回答失败'
      }
      index = buffer.indexOf('\n\n')
    }
  }

  if (failure) throw new ApiError(422, failure)
  if (!content.trim()) {
    // 流里没有正文：可能是业务失败被包成了统一响应体
    const envelope = buffer.trim()
    if (envelope) {
      try {
        const payload = JSON.parse(envelope) as { code?: number; msg?: string }
        if (payload.code && payload.code !== 200) {
          throw new ApiError(payload.code, payload.msg || 'AI 回答失败')
        }
      } catch (error) {
        if (error instanceof ApiError) throw error
      }
    }
    throw new ApiError(500, 'AI 没有返回内容，请换个问法重试')
  }
  return content
}

/** 非流式提问（流式不可用时的兜底） */
export async function askOnce(sessionId: string, question: string): Promise<string> {
  const studentId = requireStudentId()
  const result = await post<{ message: BackendMessage }>(`/qa/sessions/${sessionId}/ask`, {
    body: { student_id: Number(studentId), question, stream: false },
  })
  return result.message.content
}
