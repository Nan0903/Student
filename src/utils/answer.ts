/**
 * 关卡作答的拼装与还原。
 *
 * 背景：后端 `attempt_stage` 只有 `answer_text` 一个文本字段，而一关可能有多个填写要点
 * （`project_module.items_json` 由教师手填）。约定把多个要点的作答按固定格式拼成一段文本，
 * 既能原样回填到各个输入框，也能让教师在教师端直接读：
 *
 * ```text
 * 【检测对象描述】
 * 亚克力板，透明材质，120×80×3mm…
 *
 * 【缺陷类型定义】
 * 划痕、凹坑、脏污，判定口径为…
 * ```
 *
 * 注意事项：标题行必须独占一行。学生正文里如果自己写了「【…】」开头的一行，
 * 读回时会被当成新标题，属已知取舍（真要多题结构化落库需后端加明细表）。
 */

import type { StageGuideItem } from '@/types'

const SECTION_RE = /^【(.+?)】\s*$/

/** 题目的稳定 ID：`{moduleId}::q1`、`q2`…（页面 answers 按它存值） */
export function questionId(moduleId: string, index: number): string {
  return `${moduleId}::q${index + 1}`
}

/** 多个要点 → 一段文本；内容全空时返回空串 */
export function composeAnswerText(
  items: StageGuideItem[],
  answers: Record<string, string>,
  moduleId: string,
): string {
  if (items.length <= 1) {
    return (answers[questionId(moduleId, 0)] ?? '').trim()
  }

  const sections: string[] = []
  items.forEach((item, index) => {
    const value = (answers[questionId(moduleId, index)] ?? '').trim()
    if (!value) return
    sections.push(`【${item.title}】\n${value}`)
  })
  return sections.join('\n\n')
}

/**
 * 一段文本 → 各输入框的值。
 *
 * 兼容两种历史数据：一是本约定的「【标题】」分段文本，二是没有分段标记的整段作答
 * （早期演示数据 / 单要点关卡），后者整体落到第一个输入框。
 */
export function parseAnswerText(
  text: string,
  items: StageGuideItem[],
  moduleId: string,
): Record<string, string> {
  const result: Record<string, string> = {}
  const raw = text ?? ''
  if (!raw.trim()) return result

  const sections = new Map<string, string[]>()
  let current: string | null = null
  let plain: string[] = []

  for (const line of raw.split(/\r?\n/)) {
    const matched = SECTION_RE.exec(line.trim())
    if (matched?.[1]) {
      current = matched[1]
      sections.set(current, [])
      continue
    }
    if (current === null) plain.push(line)
    else sections.get(current)?.push(line)
  }

  // 没有分段标记：整段文本落到第一个输入框
  if (sections.size === 0) {
    result[questionId(moduleId, 0)] = plain.join('\n').trim()
    return result
  }

  items.forEach((item, index) => {
    const body = sections.get(item.title)
    if (body) result[questionId(moduleId, index)] = body.join('\n').trim()
  })
  return result
}

/** 列表里展示的作答摘要（取正文首行，去掉分段标题） */
export function answerSummary(text: string, maxLength = 48): string {
  const line =
    (text ?? '')
      .split(/\r?\n/)
      .map((item) => item.trim())
      .find((item) => item.length > 0 && !SECTION_RE.test(item)) ?? ''
  return line.length > maxLength ? `${line.slice(0, maxLength)}…` : line
}
