import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  askOnce,
  askStream,
  createSession,
  ensureSession,
  fetchMessages,
  fetchUsage,
  type QaMessage,
} from '@/api/qa'
import { ApiError } from '@/api/http'
import { formatDateTime, localId, nowText } from '@/utils/format'
import type { ChatMessage, ChatQuota } from '@/types'

/** 单次对话只保留前后三轮问答（后端也按 ai.qa.history_rounds 裁，这里只用于本地上下文展示） */
const CONTEXT_TURNS = 3
/** 单条提问字数上限（与后端 ai.qa.max_question_chars 对齐；超出后端会直接拒绝） */
const SINGLE_LIMIT = 500

function toChatMessage(row: QaMessage): ChatMessage {
  return {
    id: row.id,
    role: row.role === 'USER' ? 'user' : 'assistant',
    content: row.content,
    createdAt: formatDateTime(row.createdAt),
    failed: row.status === 'FAILED',
  }
}

/**
 * AI 助教问答。
 *
 * 会话与消息都存在后端（`/qa/*`）：打开面板时确保有一个可用会话并拉最近消息，
 * 提问走 SSE 流式；失败时退回一次性请求。token 与次数由后端统计，不设上限。
 */
export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  /** dailyLimit 恒为 0：后端只统计不限次，界面上只展示「今日已提问 N 次」 */
  const quota = ref<ChatQuota>({ singleLimit: SINGLE_LIMIT, dailyLimit: 0, used: 0 })
  const sessionId = ref('')
  const loading = ref(false)
  const sending = ref(false)
  const collapsed = ref(true)
  /** 当前页面上下文提示（随路由/项目自动变化） */
  const contextLabel = ref('成长中心')

  const usedToday = computed(() => quota.value.used)
  const canSend = computed(() => !sending.value)

  /** 发给模型的历史由后端按配置裁剪，这里只给界面用最近三条问答 */
  const contextMessages = computed(() => messages.value.slice(-CONTEXT_TURNS * 2))

  async function refreshUsage(): Promise<void> {
    try {
      const usage = await fetchUsage()
      quota.value = { ...quota.value, used: usage.today.questionCount }
    } catch {
      /* 用量拿不到不影响聊天 */
    }
  }

  async function init(): Promise<void> {
    if (messages.value.length > 0 && sessionId.value) return
    loading.value = true
    try {
      sessionId.value = await ensureSession()
      messages.value = (await fetchMessages(sessionId.value)).map(toChatMessage)
      await refreshUsage()
    } catch {
      messages.value = []
    } finally {
      loading.value = false
    }
  }

  function push(message: ChatMessage): void {
    messages.value = [...messages.value, message]
  }

  function replace(messageId: string, patch: Partial<ChatMessage>): void {
    messages.value = messages.value.map((item) =>
      item.id === messageId ? { ...item, ...patch } : item,
    )
  }

  /** 提问：先落一条用户消息与一条空的助手消息，流式往里补字 */
  async function ask(question: string): Promise<void> {
    const text = question.trim()
    if (!text || sending.value) return
    sending.value = true
    try {
      if (!sessionId.value) sessionId.value = await ensureSession()
      push({ id: localId('q'), role: 'user', content: text, createdAt: nowText() })
      const pendingId = localId('a')
      push({ id: pendingId, role: 'assistant', content: '', createdAt: nowText() })

      try {
        const answer = await askStream(sessionId.value, text, (delta) => {
          const current = messages.value.find((item) => item.id === pendingId)
          if (current) replace(pendingId, { content: current.content + delta })
        })
        replace(pendingId, { content: answer })
      } catch (streamError) {
        // 只有通道问题（网络中断 / 不是流式响应）才退回一次性请求；
        // 后端已经给出失败原因时（code=422）直接用那个原因，避免重复提问
        const isBusinessError = streamError instanceof ApiError && streamError.code !== 500
        let reason = streamError instanceof Error ? streamError.message : '回复没有送达'
        if (!isBusinessError) {
          try {
            const answer = await askOnce(sessionId.value, text)
            replace(pendingId, { content: answer })
            await refreshUsage()
            return
          } catch (fallbackError) {
            reason = fallbackError instanceof Error ? fallbackError.message : reason
          }
        }
        messages.value = messages.value.filter((item) => item.id !== pendingId)
        push({
          id: localId('failed'),
          role: 'assistant',
          content: `回复失败：${reason}。可以点「重试」再问一次。`,
          createdAt: nowText(),
          failed: true,
        })
      }
      await refreshUsage()
    } finally {
      sending.value = false
    }
  }

  /** 重试：撤掉失败提示，用最后一条提问重发 */
  async function retry(): Promise<void> {
    let lastFailedIndex = -1
    for (let index = messages.value.length - 1; index >= 0; index -= 1) {
      if (messages.value[index]?.failed) {
        lastFailedIndex = index
        break
      }
    }
    if (lastFailedIndex < 0) return
    let question: ChatMessage | undefined
    for (let index = lastFailedIndex - 1; index >= 0; index -= 1) {
      const item = messages.value[index]
      if (item && item.role === 'user') {
        question = item
        break
      }
    }
    messages.value = messages.value.filter((item) => !item.failed)
    if (question) await ask(question.content)
  }

  /** 清空对话 = 开一个新会话（历史留在后端，按保留期过期） */
  async function clear(): Promise<void> {
    messages.value = []
    sessionId.value = ''
    try {
      sessionId.value = await createSession()
    } catch {
      sessionId.value = ''
    }
  }

  function toggle(open?: boolean): void {
    collapsed.value = open ?? !collapsed.value
  }

  return {
    messages,
    quota,
    sessionId,
    loading,
    sending,
    collapsed,
    contextLabel,
    usedToday,
    canSend,
    contextMessages,
    init,
    ask,
    retry,
    clear,
    toggle,
  }
})
