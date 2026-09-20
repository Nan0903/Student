<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { ASSISTANT_MODELS } from '@/config/models'
import { chatQuickQuestions } from '@/mock/data'
import { useChatStore } from '@/stores/chat'
import { getAssistantSpot, setAssistantSpot } from '@/utils/storage'
import { formatDateTime } from '@/utils/format'
import type { QaSession } from '@/api/qa'

const route = useRoute()
const chat = useChatStore()
const draft = ref('')
const listRef = ref<HTMLElement | null>(null)

const overLimit = computed(() => draft.value.length > chat.quota.singleLimit)
const showQuick = computed(() => chat.messages.length <= 1)
const hasFailed = computed(() => chat.messages.some((item) => item.failed))
const canSubmit = computed(
  () => draft.value.trim().length > 0 && !overLimit.value && chat.canSend,
)

/* -------------------------------------------------------------------------- */
/* 悬浮球：圆形、可任意拖动，位置记在本地                                         */
/* -------------------------------------------------------------------------- */

interface Spot {
  x: number
  y: number
}

const FAB_SIZE = 58
const PANEL_W = 360
const PANEL_H = 560
const EDGE = 18

const viewport = ref({ w: window.innerWidth, h: window.innerHeight })

/** 默认停在右下角 */
function defaultSpot(): Spot {
  return {
    x: viewport.value.w - FAB_SIZE - EDGE,
    y: viewport.value.h - FAB_SIZE - EDGE,
  }
}

function clampSpot(spot: Spot): Spot {
  const maxX = Math.max(EDGE, viewport.value.w - FAB_SIZE - EDGE)
  const maxY = Math.max(EDGE, viewport.value.h - FAB_SIZE - EDGE)
  return {
    x: Math.min(Math.max(EDGE, spot.x), maxX),
    y: Math.min(Math.max(EDGE, spot.y), maxY),
  }
}

const stored = getAssistantSpot<Spot>()
const spot = ref<Spot>(
  stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)
    ? clampSpot(stored)
    : defaultSpot(),
)

const dragging = ref(false)
/** 拖动结束会紧跟一次 click，这里把它挡掉，避免误触展开/收起 */
let dragged = false
let origin = { pointerX: 0, pointerY: 0, x: 0, y: 0 }

const fabStyle = computed(() => ({ left: `${spot.value.x}px`, top: `${spot.value.y}px` }))

/** 面板贴着悬浮球展开：下方放得下就往下，否则往上，并保证不出屏 */
const panelStyle = computed(() => {
  const { w, h } = viewport.value
  const height = Math.min(PANEL_H, h - 2 * EDGE - 20)
  const below = spot.value.y + FAB_SIZE + 12 + height <= h - EDGE
  const top = below
    ? spot.value.y + FAB_SIZE + 12
    : Math.max(EDGE, spot.value.y - height - 12)
  const preferRight = spot.value.x + FAB_SIZE / 2 > w / 2
  const rawLeft = preferRight ? spot.value.x + FAB_SIZE - PANEL_W : spot.value.x
  const left = Math.min(Math.max(EDGE, rawLeft), Math.max(EDGE, w - PANEL_W - EDGE))
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${PANEL_W}px`,
    height: `${height}px`,
  }
})

function onFabPointerDown(event: PointerEvent): void {
  const element = event.currentTarget as HTMLElement
  element.setPointerCapture(event.pointerId)
  dragging.value = true
  dragged = false
  origin = {
    pointerX: event.clientX,
    pointerY: event.clientY,
    x: spot.value.x,
    y: spot.value.y,
  }
}

function onFabPointerMove(event: PointerEvent): void {
  if (!dragging.value) return
  const dx = event.clientX - origin.pointerX
  const dy = event.clientY - origin.pointerY
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragged = true
  spot.value = clampSpot({ x: origin.x + dx, y: origin.y + dy })
}

function onFabPointerUp(event: PointerEvent): void {
  if (!dragging.value) return
  dragging.value = false
  const element = event.currentTarget as HTMLElement
  element.releasePointerCapture?.(event.pointerId)
  if (dragged) setAssistantSpot(spot.value)
}

function onFabClick(): void {
  if (dragged) {
    dragged = false
    return
  }
  chat.toggleCollapsed()
}

function onViewportResize(): void {
  viewport.value = { w: window.innerWidth, h: window.innerHeight }
  spot.value = clampSpot(spot.value)
}

async function submit(): Promise<void> {
  if (!canSubmit.value) return
  const text = draft.value
  draft.value = ''
  await chat.ask(text)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.shiftKey) return
  event.preventDefault()
  void submit()
}

function askQuick(question: string): void {
  draft.value = question
  void submit()
}

function scrollToEnd(): void {
  window.requestAnimationFrame(() => {
    const element = listRef.value
    if (element) element.scrollTop = element.scrollHeight
  })
}

/** 会话列表筛选：后端支持 status=ACTIVE / CLOSED，空串表示全部 */
const sessionTabs: { label: string; value: 'ACTIVE' | 'CLOSED' | '' }[] = [
  { label: '进行中', value: 'ACTIVE' },
  { label: '已结束', value: 'CLOSED' },
  { label: '全部', value: '' },
]

/** 往上翻更早的消息：保持当前视口位置，不跳回底部 */
async function loadEarlier(): Promise<void> {
  const element = listRef.value
  const anchor = element ? element.scrollHeight - element.scrollTop : 0
  await chat.loadEarlier()
  await nextTick()
  if (element) element.scrollTop = Math.max(0, element.scrollHeight - anchor)
}

async function renameSession(session: QaSession): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt('给这个会话起个名字', '重命名会话', {
      inputValue: session.title,
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValidator: (input: string) => (input && input.trim() ? true : '名称不能为空'),
    })
    await chat.renameSession(session.id, value ?? '')
  } catch {
    /* 取消改名 */
  }
}

async function removeSession(session: QaSession): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `删除会话「${session.title}」？该会话的消息会一并删除，不可恢复。`,
      '删除会话',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  await chat.removeSession(session.id)
}

/** 只在「末尾有新消息」时滚到底：往上翻历史时不能跳到底部 */
watch(
  () => {
    const last = chat.messages[chat.messages.length - 1]
    return `${last?.id ?? ''}:${last?.content.length ?? 0}`
  },
  () => scrollToEnd(),
)
watch(
  () => chat.sending,
  (value) => {
    if (value) scrollToEnd()
  },
)
watch(
  () => chat.collapsed,
  (value) => {
    if (!value) scrollToEnd()
  },
)

/** 上下文提示随当前页面/项目自动变化 */
watch(
  () => route.fullPath,
  () => {
    if (!chat.contextLabel) chat.contextLabel = '成长中心'
  },
)

onMounted(() => {
  void chat.init()
  scrollToEnd()
  window.addEventListener('resize', onViewportResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onViewportResize)
})
</script>

<template>
  <div class="assistant">
    <section
      v-show="!chat.collapsed"
      class="assistant__panel"
      :style="panelStyle"
      aria-label="AI 助教对话框"
    >
      <header class="assistant__head">
        <div class="assistant__title">
          <span class="assistant__dot" aria-hidden="true" />
          <span class="assistant__name" :title="chat.sessionTitle">{{ chat.sessionTitle }}</span>
        </div>
        <div class="assistant__head-actions">
          <button
            class="assistant__icon-btn"
            :class="{ 'is-on': chat.historyOpen }"
            type="button"
            title="历史会话"
            @click="chat.toggleHistory()"
          >
            会话
          </button>
          <button
            class="assistant__icon-btn"
            type="button"
            title="新建会话"
            @click="chat.newSession()"
          >
            新会话
          </button>
          <button
            class="assistant__icon-btn"
            type="button"
            title="收起"
            @click="chat.collapse()"
          >
            收起
          </button>
        </div>
      </header>

      <p class="assistant__context">
        <span class="assistant__context-tag">当前上下文</span>
        {{ chat.contextLabel }}
      </p>

      <!-- 历史会话：切换 / 重命名 / 关闭 / 删除 -->
      <div v-if="chat.historyOpen" class="sessions">
        <div class="sessions__tabs">
          <button
            v-for="tab in sessionTabs"
            :key="tab.label"
            class="sessions__tab"
            :class="{ 'is-on': chat.sessionStatusFilter === tab.value }"
            type="button"
            @click="chat.setSessionFilter(tab.value)"
          >
            {{ tab.label }}
          </button>
        </div>

        <ul class="sessions__list">
          <li
            v-for="session in chat.sessions"
            :key="session.id"
            class="session"
            :class="{ 'is-on': session.id === chat.sessionId }"
          >
            <button class="session__main" type="button" @click="chat.selectSession(session.id)">
              <span class="session__title">{{ session.title }}</span>
              <span class="session__meta">
                <span class="num">{{ formatDateTime(session.updatedAt) }}</span>
                <span v-if="session.status === 'CLOSED'" class="session__flag">已结束</span>
              </span>
            </button>
            <div class="session__ops">
              <button type="button" title="重命名" @click="renameSession(session)">改名</button>
              <button
                type="button"
                :title="session.status === 'CLOSED' ? '重开会话' : '关闭会话'"
                @click="chat.toggleSessionStatus(session.id)"
              >
                {{ session.status === 'CLOSED' ? '重开' : '关闭' }}
              </button>
              <button type="button" title="删除会话" @click="removeSession(session)">删除</button>
            </div>
          </li>
        </ul>

        <p v-if="!chat.sessions.length" class="sessions__empty">
          这个筛选下还没有会话，点右上角「新会话」开一个。
        </p>
        <p v-else-if="chat.sessionTotal > chat.sessions.length" class="sessions__more">
          共 {{ chat.sessionTotal }} 个会话，当前显示最近 {{ chat.sessions.length }} 个
        </p>
      </div>

      <div v-else ref="listRef" class="assistant__list">
        <template v-if="chat.loading">
          <div class="assistant__skeleton skeleton" />
          <div class="assistant__skeleton assistant__skeleton--short skeleton" />
        </template>

        <button
          v-if="chat.hasMore && !chat.loading"
          class="load-earlier"
          type="button"
          :disabled="chat.loadingEarlier"
          @click="loadEarlier"
        >
          {{ chat.loadingEarlier ? '正在加载…' : '查看更早的消息' }}
        </button>

        <div
          v-for="message in chat.messages"
          :key="message.id"
          class="bubble"
          :class="`bubble--${message.role}`"
        >
          <span v-if="message.role === 'assistant'" class="bubble__avatar" aria-hidden="true">AI</span>
          <div class="bubble__body">
            <p class="bubble__text">{{ message.content }}</p>
            <ul v-if="message.sources?.length" class="bubble__sources">
              <li v-for="source in message.sources" :key="source.title" class="source">
                <span class="source__tag">来源</span>
                <span class="source__title">{{ source.title }}</span>
                <span class="source__snippet">{{ source.snippet }}</span>
              </li>
            </ul>
            <button
              v-if="message.failed"
              class="bubble__retry"
              type="button"
              @click="chat.retry()"
            >
              重试
            </button>
          </div>
        </div>

        <p v-if="chat.sending" class="typing">
          <span class="typing__dots" aria-hidden="true"><i /><i /><i /></span>
          {{ chat.modelLabel }} 正在输入…
        </p>
      </div>

      <div v-if="showQuick && !chat.historyOpen" class="assistant__quick">
        <button
          v-for="question in chatQuickQuestions"
          :key="question"
          class="quick"
          type="button"
          @click="askQuick(question)"
        >
          {{ question }}
        </button>
      </div>

      <footer v-if="!chat.historyOpen" class="assistant__composer">
        <!-- 模型选择：后端暂未按模型分流，选项见 config/models.ts -->
        <div class="assistant__model">
          <span class="assistant__model-label">模型</span>
          <el-select
            class="assistant__model-select"
            size="small"
            :model-value="chat.model"
            :disabled="chat.sending"
            @change="chat.setModel"
          >
            <el-option
              v-for="item in ASSISTANT_MODELS"
              :key="item.id"
              :label="item.label"
              :value="item.id"
            >
              <span>{{ item.label }}</span>
              <span class="model-desc">{{ item.desc }}</span>
            </el-option>
          </el-select>
        </div>
        <textarea
          v-model="draft"
          class="assistant__input"
          rows="2"
          placeholder="输入你的问题，Enter 发送 / Shift+Enter 换行"
          :disabled="chat.sending"
          @keydown="onKeydown"
        />
        <div class="assistant__meta">
          <span class="assistant__count" :class="{ 'is-error': overLimit }">
            <span class="num">{{ draft.length }}</span> / {{ chat.quota.singleLimit }}
          </span>
          <span class="assistant__quota">
            今日已提问 <span class="num">{{ chat.usedToday }}</span> 次
          </span>
          <el-button
            type="primary"
            size="small"
            :disabled="!canSubmit"
            :loading="chat.sending"
            @click="submit"
          >
            发送
          </el-button>
        </div>
        <p v-if="overLimit" class="assistant__error">
          单条提问不能超过 {{ chat.quota.singleLimit }} 字，请精简后再发送。
        </p>
        <p v-else-if="hasFailed" class="assistant__error">上一次回复失败，可点击「重试」。</p>
      </footer>
    </section>

    <button
      class="assistant__fab"
      :class="{ 'is-dragging': dragging }"
      :style="fabStyle"
      type="button"
      title="AI 助教（可拖动）"
      aria-label="AI 助教"
      :aria-expanded="!chat.collapsed"
      @pointerdown="onFabPointerDown"
      @pointermove="onFabPointerMove"
      @pointerup="onFabPointerUp"
      @pointercancel="onFabPointerUp"
      @click="onFabClick"
    >
      <span class="assistant__fab-text" aria-hidden="true">AI</span>
    </button>
  </div>
</template>

<style scoped>
.assistant {
  font-size: 13px;
}

/* —— 常驻模式：成长中心右侧栏 —— */
/* —— 浮动层：铺满视口但不挡操作，只有面板和悬浮球可点 —— */
.assistant {
  position: fixed;
  inset: 0;
  z-index: 40;
  pointer-events: none;
}

.assistant__panel {
  position: absolute;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  background: var(--surface);
  box-shadow: var(--sh-3);
  overflow: hidden;
  pointer-events: auto;
}

/* —— 圆形悬浮球：可拖动到任意位置 —— */
.assistant__fab {
  position: absolute;
  display: grid;
  place-items: center;
  align-items: center;
  justify-content: center;
  width: 58px;
  height: 58px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background:
    radial-gradient(120% 120% at 30% 20%, rgba(255, 255, 255, 0.28), transparent 55%),
    linear-gradient(135deg, var(--brand-500), var(--brand-700));
  color: #fff;
  font-family: inherit;
  cursor: pointer;
  box-shadow:
    0 10px 22px rgba(18, 82, 160, 0.3),
    0 0 0 4px rgba(30, 123, 232, 0.12);
  touch-action: none;
  pointer-events: auto;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.assistant__fab:hover {
  transform: translateY(-1px);
  box-shadow:
    0 14px 28px rgba(18, 82, 160, 0.38),
    0 0 0 5px rgba(30, 123, 232, 0.16);
}

.assistant__fab.is-dragging {
  cursor: grabbing;
  transform: scale(1.06);
}

/* 圆球上的标识文字 */
.assistant__fab-text {
  color: #fff;
  font-family: var(--font-num);
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-shadow: 0 1px 2px rgba(9, 62, 128, 0.35);
}

.assistant__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 16px 10px;
}

.assistant__title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--ink-1);
  font-size: 14px;
  font-weight: 700;
}

/* 标题位显示当前会话名，过长省略 */
.assistant__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assistant__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ok);
  box-shadow: 0 0 0 3px rgba(82, 196, 26, 0.16);
}

.assistant__head-actions {
  display: flex;
  gap: 2px;
  flex: none;
}

.assistant__icon-btn {
  height: 26px;
  padding: 0 9px;
  border: 0;
  border-radius: var(--r-chip);
  background: transparent;
  color: var(--ink-3);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.assistant__icon-btn:hover {
  background: var(--surface-2);
  color: var(--ink-1);
}

.assistant__icon-btn.is-on {
  background: var(--brand-050);
  color: var(--brand-600);
}

.assistant__context {
  margin: 0 16px 10px;
  padding: 9px 12px;
  border-radius: var(--r-sm);
  background: var(--brand-050);
  color: var(--ink-2);
  font-size: 12px;
  line-height: 1.55;
}

.assistant__context-tag {
  margin-right: 6px;
  color: var(--brand-600);
  font-weight: 700;
}

.assistant__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  padding: 4px 16px 12px;
  overflow-y: auto;
}

.assistant__skeleton {
  height: 54px;
}

/* —— 历史会话面板 —— */
.sessions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
  padding: 0 16px 12px;
  overflow-y: auto;
}

.sessions__tabs {
  display: flex;
  gap: 6px;
  flex: none;
}

.sessions__tab {
  padding: 3px 10px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface-2);
  color: var(--ink-2);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
}

.sessions__tab:hover {
  border-color: var(--brand-300);
  color: var(--brand-600);
}

.sessions__tab.is-on {
  border-color: var(--brand-500);
  background: var(--brand-050);
  color: var(--brand-600);
}

.sessions__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.session {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: var(--surface);
  transition: border-color 0.18s ease, background 0.18s ease;
}

.session:hover {
  border-color: var(--brand-300);
}

.session.is-on {
  border-color: var(--brand-500);
  background: var(--brand-050);
}

.session__main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.session__title {
  overflow: hidden;
  color: var(--ink-1);
  font-size: 12.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-3);
  font-size: 11px;
}

.session__flag {
  padding: 0 5px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface-2);
  line-height: 15px;
}

.session__ops {
  display: flex;
  gap: 2px;
  flex: none;
}

.session__ops button {
  padding: 2px 6px;
  border: 0;
  border-radius: var(--r-chip);
  background: transparent;
  color: var(--ink-3);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.session__ops button:hover {
  background: #fff;
  color: var(--brand-600);
}

.sessions__empty,
.sessions__more {
  color: var(--ink-3);
  font-size: 11.5px;
  line-height: 1.6;
}

/* —— 加载更早的消息 —— */
.load-earlier {
  align-self: center;
  padding: 4px 12px;
  border: 1px dashed var(--brand-300);
  border-radius: var(--r-chip);
  background: var(--brand-050);
  color: var(--brand-600);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.load-earlier:disabled {
  cursor: default;
  opacity: 0.7;
}

.assistant__skeleton--short {
  height: 36px;
  width: 70%;
}

.bubble {
  display: flex;
  gap: 8px;
}

.bubble--user {
  justify-content: flex-end;
}

.bubble__avatar {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--brand-600), var(--brand-500));
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}

.bubble__body {
  max-width: 260px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bubble__text {
  padding: 9px 12px;
  border-radius: 12px;
  background: var(--surface-2);
  color: var(--ink-1);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-line;
}

.bubble--user .bubble__text {
  background: linear-gradient(135deg, var(--brand-600), var(--brand-500));
  color: #fff;
}

.bubble__sources {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.source {
  padding: 6px 9px;
  border-left: 2px solid var(--brand-300);
  border-radius: var(--r-xs);
  background: var(--brand-050);
  font-size: 11px;
  line-height: 1.5;
  color: var(--ink-2);
}

.source__tag {
  margin-right: 5px;
  padding: 0 5px;
  border-radius: var(--r-xs);
  background: var(--brand-100);
  color: var(--brand-700);
  font-weight: 700;
}

.source__title {
  color: var(--ink-1);
  font-weight: 600;
}

.source__snippet {
  display: block;
  margin-top: 2px;
  color: var(--ink-3);
}

.bubble__retry {
  align-self: flex-start;
  padding: 2px 10px;
  border: 1px solid var(--brand-300);
  border-radius: var(--r-chip);
  background: #fff;
  color: var(--brand-600);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.typing {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ink-3);
  font-size: 12px;
}

.typing__dots {
  display: inline-flex;
  gap: 3px;
}

.typing__dots i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--brand-300);
  animation: typing-bounce 1s infinite ease-in-out;
}

.typing__dots i:nth-child(2) {
  animation-delay: 0.15s;
}

.typing__dots i:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes typing-bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  30% {
    transform: translateY(-3px);
    opacity: 1;
  }
}

.assistant__quick {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 16px 10px;
}

.quick {
  padding: 7px 11px;
  border: 1px dashed var(--brand-300);
  border-radius: var(--r-chip);
  background: transparent;
  color: var(--brand-600);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.quick:hover {
  background: var(--brand-050);
}

.assistant__composer {
  padding: 10px 16px 14px;
  border-top: 1px solid var(--line-soft);
  background: var(--surface);
}

/* —— 模型选择 —— */
.assistant__model {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.assistant__model-label {
  color: var(--ink-3);
  font-size: 11.5px;
}

.assistant__model-select {
  width: 148px;
}

/* 下拉项右侧的补充说明 */
.model-desc {
  float: right;
  margin-left: 12px;
  color: var(--ink-3);
  font-size: 11.5px;
}

.assistant__input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: var(--surface-2);
  color: var(--ink-1);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.6;
  resize: none;
  transition: border-color 0.18s ease, background 0.18s ease;
}

.assistant__input:focus {
  outline: none;
  border-color: var(--brand-300);
  background: #fff;
}

.assistant__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.assistant__count {
  color: var(--ink-3);
  font-size: 11px;
}

.assistant__count.is-error {
  color: var(--danger);
  font-weight: 700;
}

.assistant__quota {
  margin-right: auto;
  color: var(--ink-3);
  font-size: 11px;
}

.assistant__error {
  margin-top: 6px;
  color: var(--danger);
  font-size: 11.5px;
}

.assistant__warn {
  margin-top: 6px;
  color: var(--wip);
  font-size: 11.5px;
}
</style>
