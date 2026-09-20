/**
 * AI 助教可选的对话模型清单。
 *
 * 这里的 `id` 必须与后端 `system_config.ai.llm.models.<id>` 的键一致：
 * 提问时把 id 放进请求体的 `model`，后端就按那家的 base_url / model / api_key 去调用
 * （不传 `model` 用默认模型，即 `ai.llm` 的平铺字段那套）。
 * 某家还没配 api_key 时，回答会明确提示去 `ai.llm.models.<id>` 里填，不会悄悄回落到默认模型。
 */

export interface AssistantModel {
  /** 选项值：随提问提交给后端，同时作为本地记忆的键 */
  id: string
  /** 下拉里显示的名称 */
  label: string
  /** 下拉项右侧的一句话补充说明 */
  desc: string
}

export const ASSISTANT_MODELS: readonly AssistantModel[] = [
  { id: 'deepseek', label: 'DeepSeek', desc: '通用推理' },
  { id: 'kimi', label: 'Kimi', desc: '长文本理解' },
  { id: 'mimo', label: 'MiMo', desc: '轻量快速' },
]

/** 默认模型：本地没有记忆、或记忆里是已下线的模型时回落到它 */
export const DEFAULT_ASSISTANT_MODEL = 'deepseek'

/** 把任意值收敛成清单里的合法模型 id，避免本地存了历史值导致下拉显示空白 */
export function normalizeAssistantModel(value: unknown): string {
  const id = typeof value === 'string' ? value : ''
  return ASSISTANT_MODELS.some((item) => item.id === id) ? id : DEFAULT_ASSISTANT_MODEL
}
