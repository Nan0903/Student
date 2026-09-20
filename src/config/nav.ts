import type { NavItem } from '@/types'

/**
 * 主导航配置：增删入口或调整顺序只改这个数组，组件不写死导航项。
 * 每项的 key 需与路由 meta.nav 对应。
 */
export const navItems: NavItem[] = [
  { key: 'growth', label: '成长中心', path: '/growth', group: '学习与实训' },
  { key: 'skill-tree', label: '技能树', path: '/skill-tree', group: '学习与实训' },
  { key: 'map', label: '关卡地图', path: '/map', group: '学习与实训' },
  { key: 'certification', label: '认证中心', path: '/certification', group: '岗位与认证' },
]

/** 平台信息：登录页与页脚展示 */
export const platformInfo = {
  school: '深圳职业技术大学',
  college: '人工智能本科学院',
  platform: '岗位闯关式实训平台',
  version: 'v1.0',
  /** 技能树右上角统计面板开关 */
  showSkillStats: true,
}
