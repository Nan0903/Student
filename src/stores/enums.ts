import { ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchEnumLabels, type EnumLabelMap } from '@/api/enums'

/**
 * 枚举字典缓存。
 *
 * 用法：`enums.label('student_project_status', 'IN_PROGRESS', '进行中')`
 * —— 字典里有就用后端的文案，没有（或还没加载完 / 接口挂了）就用兜底文案。
 */
export const useEnumStore = defineStore('enums', () => {
  const labels = ref<EnumLabelMap>({})
  const loaded = ref(false)
  let pending: Promise<void> | null = null

  /** 全站只拉一次；失败时保持空字典，页面继续用兜底文案 */
  async function load(): Promise<void> {
    if (loaded.value) return
    if (!pending) {
      pending = fetchEnumLabels()
        .then((data) => {
          labels.value = data
          loaded.value = true
        })
        .catch(() => {
          /* 字典拿不到不影响页面展示 */
        })
        .finally(() => {
          pending = null
        })
    }
    await pending
  }

  function label(dictKey: string, code: string | null | undefined, fallback: string): string {
    if (!code) return fallback
    return labels.value[dictKey]?.[code] ?? fallback
  }

  return { labels, loaded, load, label }
})
