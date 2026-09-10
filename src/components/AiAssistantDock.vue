<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { chatQuickQuestions } from '@/mock/data'
import { useChatStore } from '@/stores/chat'

const props = withDefaults(defineProps<{ mode?: 'docked' | 'floating' }>(), { mode: 'floating' })

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

const docked = computed(() => props.mode === 'docked')
/** 岗位选择页底部有固定操作条，悬浮球上移避让，避免遮挡按钮 */
const raised = computed(() => props.mode === 'floating' && route.name === 'positions')

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

watch(() => chat.messages.length, scrollToEnd)
watch(
  () => chat.sending,
  (value) => {
    if (value) scrollToEnd()
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
})
</script>

<template>
  <div
    class="assistant"
    :class="[docked ? 'assistant--docked' : 'assistant--floating', { 'assistant--raised': raised }]"
  >
    <section v-show="docked || !chat.collapsed" class="assistant__panel" aria-label="AI 助教对话框">
      <header class="assistant__head">
        <div class="assistant__title">
          <span class="assistant__dot" aria-hidden="true" />
          <span>AI 助教对话框</span>
        </div>
        <div class="assistant__head-actions">
          <button class="assistant__icon-btn" type="button" title="清空对话" @click="chat.clear()">
            ⟲
          </button>
          <button
            v-if="!docked"
            class="assistant__icon-btn"
            type="button"
            title="收起"
            @click="chat.toggle(false)"
          >
            ✕
          </button>
        </div>
      </header>

      <p class="assistant__context">
        <span class="assistant__context-tag">当前上下文</span>
        {{ chat.contextLabel }}
      </p>

      <div ref="listRef" class="assistant__list">
        <template v-if="chat.loading">
          <div class="assistant__skeleton skeleton" />
          <div class="assistant__skeleton assistant__skeleton--short skeleton" />
        </template>

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
          对方正在输入…
        </p>
      </div>

      <div v-if="showQuick" class="assistant__quick">
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

      <footer class="assistant__composer">
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
            今日剩余 <span class="num">{{ chat.remaining }}</span> / {{ chat.quota.dailyLimit }} 次
          </span>
          <el-button
            type="primary"
            size="small"
            round
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
        <p v-else-if="chat.nearLimit" class="assistant__warn">今日提问次数接近上限，请合理安排。</p>
      </footer>
    </section>

    <button
      v-if="!docked"
      class="assistant__ball"
      type="button"
      :aria-expanded="!chat.collapsed"
      @click="chat.toggle()"
    >
      <span aria-hidden="true">💬</span>
      <span class="assistant__ball-text">AI 助教</span>
    </button>
  </div>
</template>

<style scoped>
.assistant {
  font-size: 13px;
}

/* —— 常驻模式：成长中心右侧栏 —— */
.assistant--docked .assistant__panel {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--header-h) - var(--nav-h) - 48px);
  max-height: 720px;
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  background: var(--surface);
  box-shadow: var(--sh-2);
  overflow: hidden;
}

/* —— 浮动模式：右下角悬浮球 —— */
.assistant--floating {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}

.assistant--floating.assistant--raised {
  bottom: 104px;
}

.assistant--floating .assistant__panel {
  display: flex;
  flex-direction: column;
  width: 360px;
  height: min(560px, calc(100vh - 160px));
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  background: var(--surface);
  box-shadow: var(--sh-3);
  overflow: hidden;
}

.assistant__ball {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border: 0;
  border-radius: var(--r-pill);
  background: linear-gradient(135deg, var(--brand-600), var(--brand-500));
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: var(--sh-2);
  transition: transform 0.18s ease;
}

.assistant__ball:hover {
  transform: translateY(-2px);
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
  color: var(--ink-1);
  font-size: 14px;
  font-weight: 700;
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
}

.assistant__icon-btn {
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--ink-3);
  font-size: 13px;
  cursor: pointer;
}

.assistant__icon-btn:hover {
  background: var(--surface-2);
  color: var(--ink-1);
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
  border-radius: var(--r-pill);
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
  border-radius: var(--r-sm);
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
