import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { useUserStore } from '@/stores/user'

declare module 'vue-router' {
  interface RouteMeta {
    /** 主导航高亮项，对应 src/config/nav.ts 的 key；子路由填父级入口的 key */
    nav?: string
    /** 免登录页面 */
    public?: boolean
    title?: string
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, title: '登录' },
  },
  {
    path: '/',
    component: DefaultLayout,
    children: [
      { path: '', redirect: '/growth' },
      {
        path: 'growth',
        name: 'growth',
        component: () => import('@/views/GrowthCenterView.vue'),
        meta: { nav: 'growth', title: '成长中心' },
      },
      {
        path: 'skill-tree',
        name: 'skill-tree',
        component: () => import('@/views/SkillTreeView.vue'),
        meta: { nav: 'skill-tree', title: '技能树' },
      },
      {
        path: 'map',
        name: 'level-map',
        component: () => import('@/views/LevelMapView.vue'),
        meta: { nav: 'map', title: '关卡地图' },
      },
      {
        path: 'map/project/:projectId',
        name: 'project-level',
        component: () => import('@/views/ProjectLevelView.vue'),
        meta: { nav: 'map', title: '关卡详情' },
      },
      {
        path: 'positions',
        name: 'positions',
        component: () => import('@/views/PositionSelectView.vue'),
        meta: { nav: 'positions', title: '岗位选择' },
      },
      {
        path: 'certification',
        name: 'certification',
        component: () => import('@/views/CertificationView.vue'),
        meta: { nav: 'certification', title: '认证中心' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { public: true, title: '页面不存在' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const user = useUserStore()

  if (!to.meta.public && !user.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (to.path === '/login' && user.isLoggedIn) {
    return { path: '/growth' }
  }

  return true
})

router.afterEach((to) => {
  document.title = to.meta.title
    ? `${to.meta.title} · 岗位闯关式实训平台`
    : '岗位闯关式实训平台'
})

export default router
