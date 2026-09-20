<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import type { Project } from '@/types'

/**
 * 「项目 + 加入关卡地图」一行。
 *
 * 技能体系（技能点详情）与岗位体系（岗位详情）共用：点行进入项目详情，
 * 右侧按钮负责把自己挑的项目加进 / 移出关卡地图（后端「我的实训」清单）—— 未加入显示「+」，已加入显示「已加入」。
 * 老师点名必修的项目带「必修」标记，它本来就会出现在关卡地图上，学生还可以自己再挑一次。
 */
const props = defineProps<{ project: Project }>()
const emit = defineEmits<{ open: [project: Project] }>()

const projectStore = useProjectStore()
/** 正在请求中：同一行按钮置灰，避免连点重复提交 */
const picking = ref(false)

/** 完成度 = 已通过关卡 ÷ 关卡总数（整单提交/已完成按满关计，与技能点进度口径一致） */
const percent = computed(() => {
  const total = props.project.levelTotal
  if (!total) return 0
  const done = projectStore.passedOf(props.project.id)
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)))
})

/**
 * 加进 / 移出关卡地图（后端 my-projects 清单）。
 *
 * 两边都是幂等的：加入直接生效；移出前先确认，必修项目会额外说明"移出后仍在地图上"。
 * 后端拒绝时（项目没发布等）把原因原样提示。
 */
async function toggle(): Promise<void> {
  if (picking.value) return
  const project = props.project
  if (project.picked) {
    try {
      await ElMessageBox.confirm(
        project.isRequired
          ? `「${project.name}」是老师点名的必修项目，移除后仍会留在你的关卡地图上。确认移除？`
          : `把「${project.name}」从关卡地图移除？已经开始的闯关记录不会丢，之后还能重新加入。`,
        '移除关卡地图',
        { confirmButtonText: '移出', cancelButtonText: '取消', type: 'warning' },
      )
    } catch {
      return
    }
  }

  picking.value = true
  try {
    if (project.picked) {
      await projectStore.unpickProject(project.id)
      ElMessage.success(
        project.isRequired
          ? `已把「${project.name}」移除关卡地图；它是必修项目，仍会留在地图上`
          : `已把「${project.name}」移除关卡地图`,
      )
    } else {
      await projectStore.pickProject(project.id)
      ElMessage.success(`已把「${project.name}」加入关卡地图`)
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败，请稍后重试')
  } finally {
    picking.value = false
  }
}
</script>

<template>
  <div class="pick-row">
    <button class="pick-row__main" type="button" @click="emit('open', project)">
      <span class="pick-row__name">{{ project.name }}</span>
      <span v-if="project.isRequired" class="pick-row__required" title="老师发任务点名要求完成">
        必修
      </span>
      <span class="pick-row__bar">
        <span class="pick-row__bar-fill" :style="{ width: `${percent}%` }" />
      </span>
      <span class="pick-row__percent num">{{ percent }}%</span>
    </button>
    <button
      class="pick-row__pick"
      :class="{ 'is-on': project.picked }"
      type="button"
      :disabled="picking"
      :title="project.picked ? '已加入关卡地图，点击移除' : '加入关卡地图'"
      :aria-label="project.picked ? `移除${project.name}` : `加入${project.name}`"
      @click="toggle"
    >
      {{ project.picked ? '已加入' : '+' }}
    </button>
  </div>
</template>

<style scoped>
.pick-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pick-row__main {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface);
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease;
}

.pick-row__main:hover {
  border-color: var(--brand-300);
  background: var(--brand-050);
}

.pick-row__name {
  flex: 1;
  min-width: 0;
  color: var(--ink-1);
  font-size: 12.5px;
  font-weight: 600;
  text-align: left;
}

/* 老师点名必修：自己挑过的项目也可能带这个标记 */
.pick-row__required {
  flex: none;
  padding: 0 6px;
  border-radius: var(--r-chip);
  background: var(--wip-bg);
  color: #b35c00;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
}

.pick-row__bar {
  width: 84px;
  height: 4px;
  flex: none;
  overflow: hidden;
  border-radius: var(--r-bar);
  background: var(--line-soft);
}

.pick-row__bar-fill {
  display: block;
  height: 100%;
  border-radius: var(--r-bar);
  background: var(--brand-500);
}

.pick-row__percent {
  width: 36px;
  flex: none;
  color: var(--ink-2);
  font-size: 12px;
  font-weight: 700;
  text-align: right;
}

/* 加入关卡地图的开关：未加入显示「+」，已加入显示「已加入」 */
.pick-row__pick {
  flex: none;
  min-width: 52px;
  height: 32px;
  padding: 0 10px;
  border: 1px dashed var(--brand-300);
  border-radius: var(--r-chip);
  background: var(--brand-050);
  color: var(--brand-600);
  font-family: inherit;
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
}

.pick-row__pick:hover {
  border-color: var(--brand-500);
  background: var(--brand-100);
}

.pick-row__pick.is-on {
  border-style: solid;
  border-color: var(--line);
  background: var(--surface-2);
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 600;
}

.pick-row__pick.is-on:hover {
  border-color: var(--danger);
  background: #fff1f0;
  color: var(--danger);
}

.pick-row__pick:disabled {
  cursor: default;
  opacity: 0.6;
}
</style>
