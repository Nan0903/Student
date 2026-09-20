import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  askOnce,
  askStream,
  createSession,
  deleteSession,
  ensureSession,
  fetchMessagePage,
  fetchSession,
  fetchSessions,
  fetchUsage,
  updateSession,
  type QaMessage,
  type QaSession,
} from '@/api/qa'
import { ApiError } from '@/api/http'
import { ASSISTANT_MODELS, normalizeAssistantModel } from '@/config/models'
import { formatDateTime, localId, nowText } from '@/utils/format'
import { getAssistantModel, setAssistantModel } from '@/utils/storage'
import type { ChatMessage, ChatQuota } from '@/types'

/** 单次对话只保留前后三轮问答（后端也按 ai.qa.history_rounds 裁，这里只用于本地上下文展示） */
const CONTEXT_TURNS = 3
/** 单条提问字数上限（与后端 ai.qa.max_question_chars 对齐；超出后端会直接拒绝） */
const SINGLE_LIMIT = 500
/** 一屏消息条数：与后端 /qa/sessions/{id} 默认的最近 30 条对齐 */
const MESSAGE_PAGE = 30
/** 会话列表每页条数 */
const SESSION_PAGE = 20

function toChatMessage(row: QaMessage): ChatMessage {
  return {
    id: row.id,
    role: row.role === 'USER' ? 'user' : 'assistant',
    content: row.content,
    createdAt: formatDateTime(row.createdAt),
    failed: row.status === 'FAILED',
    model: row.modelName ?? undefined,
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
  /** 历史会话列表（updated_at 倒序） */
  const sessions = ref<QaSession[]>([])
  const sessionTotal = ref(0)
  /** 会话列表筛选：undefined = 全部 */
  const sessionStatusFilter = ref<'ACTIVE' | 'CLOSED' | ''>('')
  /** 更早消息的游标；null 表示已经翻到最早一条 */
  const nextBeforeId = ref<string | null>(null)
  const loading = ref(false)
  /** 正在往上翻更早的消息 */
  const loadingEarlier = ref(false)
  const sending = ref(false)
  const collapsed = ref(true)
  /** 是否展开「历史会话」面板 */
  const historyOpen = ref(false)
  /** 当前页面上下文提示（随路由/项目自动变化） */
  const contextLabel = ref('成长中心')
  /** 学生选择的对话模型，见 `config/models.ts`；只决定后续提问用哪个模型 */
  const model = ref<string>(normalizeAssistantModel(getAssistantModel()))

  const usedToday = computed(() => quota.value.used)
  const canSend = computed(() => !sending.value)
  const modelLabel = computed(
    () => ASSISTANT_MODELS.find((item) => item.id === model.value)?.label ?? model.value,
  )
  const currentSession = computed(
    () => sessions.value.find((item) => item.id === sessionId.value) ?? null,
  )
  const sessionTitle = computed(() => currentSession.value?.title || 'AI 助教')
  const hasMore = computed(() => Boolean(nextBeforeId.value))

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

  /* —— 会话 —— */

  /** 把后端返回的会话同步进列表（更新过、或新建的都放最前面） */
  function upsertSession(session: QaSession): void {
    sessions.value = [session, ...sessions.value.filter((item) => item.id !== session.id)]
  }

  /** 拉一页历史会话（默认第一页，updated_at 倒序） */
  async function loadSessions(page = 1): Promise<void> {
    try {
      const result = await fetchSessions({
        page,
        pageSize: SESSION_PAGE,
        status: sessionStatusFilter.value || undefined,
      })
      sessions.value = result.items
      sessionTotal.value = result.total
    } catch {
      /* 会话列表拿不到不影响正在进行的对话 */
    }
  }

  /** 打开某个会话：拿会话信息 + 最近 30 条消息（正序），并记录更早消息的游标 */
  async function openSession(id: string): Promise<void> {
    const detail = await fetchSession(id, MESSAGE_PAGE)
    sessionId.value = id
    messages.value = detail.messages.map(toChatMessage)
    nextBeforeId.value =
      detail.messages.length >= MESSAGE_PAGE ? (detail.messages[0]?.id ?? null) : null
    upsertSession(detail.session)
  }

  /** 切换会话 */
  async function selectSession(id: string): Promise<void> {
    historyOpen.value = false
    if (id === sessionId.value || loading.value) return
    loading.value = true
    try {
      await openSession(id)
    } catch {
      /* 打开失败就留在原来的会话 */
    } finally {
      loading.value = false
    }
  }

  /** 新建会话：只有 student_id 必填，标题交给后端（首问后自动成标题） */
  async function newSession(): Promise<void> {
    try {
      const session = await createSession()
      upsertSession(session)
      sessionId.value = session.id
      messages.value = []
      nextBeforeId.value = null
      historyOpen.value = false
      await loadSessions()
    } catch {
      /* 新建失败保持原会话 */
    }
  }

  /** 往上翻更早的一屏消息（游标 next_before_id，null 表示到底） */
  async function loadEarlier(): Promise<void> {
    const cursor = nextBeforeId.value
    if (!cursor || loadingEarlier.value || !sessionId.value) return
    loadingEarlier.value = true
    try {
      const page = await fetchMessagePage(sessionId.value, cursor, MESSAGE_PAGE)
      const older = page.items.map(toChatMessage)
      if (older.length > 0) messages.value = [...older, ...messages.value]
      nextBeforeId.value = page.nextBeforeId
    } finally {
      loadingEarlier.value = false
    }
  }

  /** 重命名会话 */
  async function renameSession(id: string, title: string): Promise<void> {
    const name = title.trim()
    if (!name) return
    try {
      upsertSession(await updateSession(id, { title: name }))
    } catch {
      /* 改名失败不动列表 */
    }
  }

  /** 关闭 / 重开会话（CLOSED / ACTIVE） */
  async function toggleSessionStatus(id: string): Promise<void> {
    const target = sessions.value.find((item) => item.id === id)
    const status = target?.status === 'CLOSED' ? 'ACTIVE' : 'CLOSED'
    try {
      const session = await updateSession(id, { status })
      upsertSession(session)
      if (sessionStatusFilter.value && session.status !== sessionStatusFilter.value) {
        sessions.value = sessions.value.filter((item) => item.id !== session.id)
      }
    } catch {
      /* 忽略：状态没改成 */
    }
  }

  /** 删除会话（后端连带删除消息与引用） */
  async function removeSession(id: string): Promise<void> {
    try {
      await deleteSession(id)
    } catch {
      return
    }
    sessions.value = sessions.value.filter((item) => item.id !== id)
    sessionTotal.value = Math.max(0, sessionTotal.value - 1)
    if (id !== sessionId.value) return
    // 删掉的是当前会话：优先切到列表里的下一个，没有就新建
    sessionId.value = ''
    messages.value = []
    nextBeforeId.value = null
    const next = sessions.value[0]
    if (next) await openSession(next.id)
    else await newSession()
  }

  async function setSessionFilter(status: 'ACTIVE' | 'CLOSED' | ''): Promise<void> {
    sessionStatusFilter.value = status
    await loadSessions()
  }

  function toggleHistory(open?: boolean): void {
    historyOpen.value = open ?? !historyOpen.value
  }

  /** 切换对话模型：立即记忆到本地，已在生成中的回答不受影响 */
  function setModel(id: string): void {
    const next = normalizeAssistantModel(id)
    model.value = next
    setAssistantModel(next)
  }

  async function init(): Promise<void> {
    if (messages.value.length > 0 && sessionId.value) return
    loading.value = true
    try {
      await loadSessions()
      const first = sessions.value[0] ?? (await ensureSession())
      await openSession(first.id)
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
      if (!sessionId.value) {
        const session = await ensureSession()
        sessionId.value = session.id
      }
      push({ id: localId('q'), role: 'user', content: text, createdAt: nowText() })
      const pendingId = localId('a')
      push({ id: pendingId, role: 'assistant', content: '', createdAt: nowText() })

      try {
        const answer = await askStream(sessionId.value, text, {
          model: model.value,
          // 首帧 meta 带回真实模型名：选的是 Kimi 就用 kimi 那套，这里照实记下来
          onModel: (info) => replace(pendingId, { model: info.model }),
          onDelta: (delta) => {
            const current = messages.value.find((item) => item.id === pendingId)
            if (current) replace(pendingId, { content: current.content + delta })
          },
        })
        replace(pendingId, { content: answer })
      } catch (streamError) {
        // 只有通道问题（网络中断 / 不是流式响应）才退回一次性请求；
        // 后端已经给出失败原因时（code=422）直接用那个原因，避免重复提问
        const isBusinessError = streamError instanceof ApiError && streamError.code !== 500
        let reason = streamError instanceof Error ? streamError.message : '回复没有送达'
        if (!isBusinessError) {
          try {
            const answer = await askOnce(sessionId.value, text, model.value)
            replace(pendingId, { content: answer.content, model: answer.model })
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
      // 回答完刷新用量与会话列表（后端会把首问当作会话标题、并更新 updated_at）
      await Promise.all([refreshUsage(), loadSessions()])
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

  /* —— 面板展开 / 收起 —— */

  /** 展开对话面板 */
  function expand(): void {
    collapsed.value = false
  }

  /**
   * 收起对话面板。
   * 顺带关掉「历史会话」浮层，下次再点开就直接看到对话本身。
   */
  function collapse(): void {
    collapsed.value = true
    historyOpen.value = false
  }

  /** 悬浮球点击：在展开与收起之间切换 */
  function toggleCollapsed(): void {
    if (collapsed.value) expand()
    else collapse()
  }

  return {
    messages,
    quota,
    sessionId,
    sessions,
    sessionTotal,
    sessionStatusFilter,
    currentSession,
    sessionTitle,
    nextBeforeId,
    hasMore,
    loading,
    loadingEarlier,
    sending,
    collapsed,
    historyOpen,
    contextLabel,
    model,
    modelLabel,
    usedToday,
    canSend,
    contextMessages,
    init,
    ask,
    retry,
    loadEarlier,
    loadSessions,
    selectSession,
    newSession,
    renameSession,
    toggleSessionStatus,
    removeSession,
    setSessionFilter,
    toggleHistory,
    setModel,
    expand,
    collapse,
    toggleCollapsed,
  }
})
