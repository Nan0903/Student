/** AI 助教问答 */

import { mockRequest } from '@/utils/request'
import { chatQuota, chatReplies, chatSeed } from '@/mock/data'
import { localId, nowText } from '@/utils/format'
import type { ChatMessage, ChatQuota } from '@/types'

export function fetchChatSeed(): Promise<ChatMessage[]> {
  return mockRequest({ delay: [150, 300], resolve: () => chatSeed })
}

export function fetchChatQuota(): Promise<ChatQuota> {
  return mockRequest({ auth: false, delay: [100, 200], resolve: () => ({ ...chatQuota }) })
}

/**
 * 发送提问 → 返回带知识库来源标注的回复。
 * 注意：上下文只保留最近三轮，由调用方（store）裁剪后传入。
 */
export function sendQuestion(
  question: string,
  context: ChatMessage[],
): Promise<ChatMessage> {
  return mockRequest({
    delay: [800, 1500],
    resolve: () => {
      const matched =
        chatReplies.find((reply) => reply.keywords.some((keyword) => question.includes(keyword))) ??
        null
      const contextHint =
        context.length > 0 ? `（已结合最近 ${Math.min(context.length, 6)} 条上下文）` : ''
      return {
        id: localId('a'),
        role: 'assistant',
        content: matched
          ? `${matched.content}${contextHint}`
          : `这个问题可以拆成三步来看：先确认检测对象与判定口径，再选择成像与算法路线，最后用数据验证结论。${contextHint}你也可以把当前的作答内容贴给我，我帮你逐条对照验收标准。`,
        sources: matched?.sources ?? [
          { title: '实训指导手册 · 总纲', snippet: '检测任务的分析路径：对象 → 口径 → 方案 → 验证。' },
        ],
        createdAt: nowText(),
      }
    },
  })
}
