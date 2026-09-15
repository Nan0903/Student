/**
 * 枚举字典（对接 training_platform 的 `/api/enums`）。
 *
 * 后端把「状态 code → 中文文案」集中维护在字典里（27 组），前端不必各写一份；
 * 拿不到字典时由调用方用自己的兜底文案，不会把 code 直接暴露到界面上。
 */

import { get } from './http'

export interface EnumDict {
  key: string
  title: string
  items: { code: string; label: string }[]
}

/** `{字典 key: {code: 中文文案}}`，便于直接下标取用 */
export type EnumLabelMap = Record<string, Record<string, string>>

let cache: EnumLabelMap | null = null

/** 拉一次全部字典，转成 `{key: {code: label}}` 并缓存在内存里 */
export async function fetchEnumLabels(force = false): Promise<EnumLabelMap> {
  if (cache && !force) return cache
  const dicts = await get<EnumDict[]>('/enums')
  const result: EnumLabelMap = {}
  for (const dict of dicts) {
    result[dict.key] = Object.fromEntries(dict.items.map((item) => [item.code, item.label]))
  }
  cache = result
  return result
}
