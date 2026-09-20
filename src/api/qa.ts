/**
 * AI 助教问答（对接 training_platform 的 /qa 接口）。
 *
 * - 会话列表：`GET /qa/sessions?student_id=&page_size=20`
 * - 会话详情：`GET /qa/sessions/{id}?student_id=` —— 默认带最近 30 条消息，按时间正序
 * - 历史翻页：`GET /qa/sessions/{id}/messages?student_id=&before_id=` —— 不带 before_id 取最新一屏，
 *   响应里的 `next_before_id` 就是下一页游标
 * - 提问：`POST /qa/sessions/{id}/ask`，默认 SSE 流式（meta → delta* → done / error），
 *   失败可退回 `stream=false` 一次性返回
 * - 用量：`GET /qa/usage`（后端只统计不限制）
 */

import { API_BASE_URL } from '@/config/env'
import { getToken } from '@/utils/storage'
import { ApiError, del, get, patch, post, type Page } from './http'
import { requireStudentId } from './session'

export interface QaMessage {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  status: string
  createdAt: string
}

/** AI 会话（历史会话列表 / 会话切换用） */
export interface QaSession {
  id: string
  title: string
  subject: string
  status: string
  createdAt: string
  updatedAt: string
}

/** 历史消息一屏 */
export interface QaMessagePage {
  items: QaMessage[]
  total: number
  /** 还有更早的消息时给出下一页游标；没有更早的则为 null */
  nextBeforeId: string | null
}

/** 会话列表的分页信封 */
export interface QaSessionPage {
  items: QaSession[]
  total: number
  page: number
  pageSize: number
  pages: number
}

export interface QaUsage {
  retentionDays: number
  today: { questionCount: number; totalTokens: number }
  recent: { questionCount: number; totalTokens: number }
}

interface BackendSession {
  id: number
  title: string | null
  subject: string | null
  status: string
  created_at: string
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

interface BackendMessagePage {
  items: BackendMessage[]
  total: number
  next_before_id: number | null
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

function toQaSession(row: BackendSession): QaSession {
  return {
    id: String(row.id),
    title: row.title?.trim() || '新会话',
    subject: row.subject ?? '',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** 新建会话 */
export async function createSession(title = 'AI 助教'): Promise<QaSession> {
  const studentId = requireStudentId()
  const row = await post<BackendSession>('/qa/sessions', {
    body: { student_id: Number(studentId), title },
  })
  return toQaSession(row)
}

/**
 * 会话列表：`GET /qa/sessions?student_id=&page=&page_size=&status=`
 * 分页信封，`updated_at` 倒序，只含保留期内活动过的会话。
 */
export async function fetchSessions(
  params: { page?: number; pageSize?: number; status?: 'ACTIVE' | 'CLOSED' } = {},
): Promise<QaSessionPage> {
  const studentId = requireStudentId()
  const page = await get<Page<BackendSession>>('/qa/sessions', {
    query: {
      student_id: studentId,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20,
      status: params.status,
    },
  })
  return {
    items: page.items.map(toQaSession),
    total: page.total ?? 0,
    page: page.page ?? 1,
    pageSize: page.page_size ?? 20,
    pages: page.pages ?? 1,
  }
}

/** 拿最近一个还在用的会话；没有就新建（后端按保留期过滤，过期的会话不会返回） */
export async function ensureSession(): Promise<QaSession> {
  const { items } = await fetchSessions({ pageSize: 20 })
  const first = items[0]
  if (first) return first
  return createSession()
}

/** 重命名 / 关闭（status=CLOSED）/ 重开（status=ACTIVE） */
export async function updateSession(
  sessionId: string,
  changes: { title?: string; status?: 'ACTIVE' | 'CLOSED' },
): Promise<QaSession> {
  const studentId = requireStudentId()
  const row = await patch<BackendSession>(`/qa/sessions/${sessionId}`, {
    query: { student_id: studentId },
    body: changes,
  })
  return toQaSession(row)
}

/** 删除会话：后端会连带删除消息与引用（物理删除） */
export async function deleteSession(sessionId: string): Promise<void> {
  const studentId = requireStudentId()
  await del<unknown>(`/qa/sessions/${sessionId}`, { query: { student_id: studentId } })
}

/** 会话详情：会话信息 + 最近 30 条消息（按时间正序） */
export async function fetchSession(
  sessionId: string,
  messageLimit = 30,
): Promise<{ session: QaSession; messages: QaMessage[] }> {
  const studentId = requireStudentId()
  const detail = await get<BackendSessionDetail>(`/qa/sessions/${sessionId}`, {
    query: { student_id: studentId, message_limit: messageLimit },
  })
  return {
    session: toQaSession(detail),
    messages: (detail.messages ?? []).map(toQaMessage),
  }
}

/**
 * 会话历史消息一屏。
 * 不传 beforeId 时取最新一屏；翻更早的消息时把上一屏响应里的 `nextBeforeId` 传进来。
 */
export async function fetchMessagePage(
  sessionId: string,
  beforeId?: string | null,
  limit = 30,
): Promise<QaMessagePage> {
  const studentId = requireStudentId()
  const page = await get<BackendMessagePage>(`/qa/sessions/${sessionId}/messages`, {
    query: {
      student_id: studentId,
      before_id: beforeId ?? undefined,
      limit,
    },
  })
  return {
    items: page.items.map(toQaMessage),
    total: page.total ?? 0,
    nextBeforeId: page.next_before_id == null ? null : String(page.next_before_id),
  }
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

/** 提问参数 */
export interface AskOptions {
  /**
   * 学生选择的模型标识（见 `config/models.ts`）。
   * 后端目前只有一套 LLM 配置，收到该字段也不会分流，先按协议传着。
   */
  model?: string
  /** 流式增量回调：每收到一段就交给调用方拼接 */
  onDelta: (text: string) => void
}

/** 流式提问：边收边回调，返回完整回答 */
export async function askStream(
  sessionId: string,
  question: string,
  options: AskOptions,
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
      body: JSON.stringify({
        student_id: Number(studentId),
        question,
        stream: true,
        model: options.model,
      }),
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
          options.onDelta(text)
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

/** 非流式提问（流式不可用时的兜底），`model` 语义同 `askStream` */
export async function askOnce(sessionId: string, question: string, model?: string): Promise<string> {
  const studentId = requireStudentId()
  const result = await post<{ message: BackendMessage }>(`/qa/sessions/${sessionId}/ask`, {
    body: { student_id: Number(studentId), question, stream: false, model },
  })
  return result.message.content
}
