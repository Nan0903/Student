/**
 * AI 助教可选的对话模型清单。
 *
 * 现状：后端 `ai.llm` 只有一套 LLM 配置（DeepSeek 的 base_url / model / api_key），
 * 因此三个选项实际都由 DeepSeek 回答 —— 前端会把所选模型随提问一起提交（`model` 字段），
 * 后端按模型分流后即生效，届时只需要改这里的 id 与后端配置的对应关系。
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
