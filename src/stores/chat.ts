import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchChatQuota, fetchChatSeed, sendQuestion } from '@/api/chat'
import { getChatCache, setChatCache } from '@/utils/storage'
import { localId, nowText } from '@/utils/format'
import { withRetry } from '@/utils/request'
import type { ChatMessage, ChatQuota } from '@/types'

/** 单次对话只保留前后三轮问答作为上下文 */
const CONTEXT_TURNS = 3
/** 仅保留一周内的历史对话 */
const HISTORY_KEEP_MS = 7 * 24 * 60 * 60 * 1000

function withinAWeek(message: ChatMessage): boolean {
  const time = new Date(message.createdAt.replace(/-/g, '/')).getTime()
  if (Number.isNaN(time)) return true
  return Date.now() - time < HISTORY_KEEP_MS
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const quota = ref<ChatQuota>({ singleLimit: 500, dailyLimit: 50, used: 0 })
  const loading = ref(false)
  const sending = ref(false)
  const collapsed = ref(true)
  /** 当前页面上下文提示（随路由/项目自动变化） */
  const contextLabel = ref('成长中心')

  const usedCount = computed(() => messages.value.filter((item) => item.role === 'user').length)
  const remaining = computed(() => Math.max(0, quota.value.dailyLimit - usedCount.value))
  const nearLimit = computed(() => remaining.value <= 5)
  const canSend = computed(() => !sending.value && remaining.value > 0)

  /** 发给模型的历史：只带最近三轮（用户+助手共 6 条） */
  const contextMessages = computed(() => messages.value.slice(-CONTEXT_TURNS * 2))

  async function init(): Promise<void> {
    if (messages.value.length > 0) return
    loading.value = true
    try {
      const cached = getChatCache<ChatMessage[]>()
      if (cached && cached.length > 0) {
        messages.value = cached.filter(withinAWeek)
      } else {
        const seed = await fetchChatSeed()
        messages.value = seed.map((item) => ({ ...item, createdAt: nowText() }))
      }
      quota.value = await fetchChatQuota()
    } finally {
      loading.value = false
    }
  }

  function persist(): void {
    setChatCache(messages.value.filter(withinAWeek))
  }

  function push(message: ChatMessage): void {
    messages.value = [...messages.value, message]
    persist()
  }

  async function ask(question: string): Promise<void> {
    const text = question.trim()
    if (!text || sending.value) return
    push({
      id: localId('q'),
      role: 'user',
      content: text,
      createdAt: nowText(),
    })
    sending.value = true
    try {
      const reply = await withRetry(() => sendQuestion(text, contextMessages.value.slice(0, -1)))
      push(reply)
    } catch {
      push({
        id: localId('failed'),
        role: 'assistant',
        content: '网络似乎不太稳定，回复没有送达。可以点「重试」再问一次。',
        createdAt: nowText(),
        failed: true,
      })
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
    if (question) {
      await ask(question.content)
    }
  }

  function clear(): void {
    messages.value = []
    persist()
    void init()
  }

  function toggle(open?: boolean): void {
    collapsed.value = open ?? !collapsed.value
  }

  return {
    messages,
    quota,
    loading,
    sending,
    collapsed,
    contextLabel,
    remaining,
    nearLimit,
    canSend,
    contextMessages,
    init,
    ask,
    retry,
    clear,
    toggle,
  }
})
