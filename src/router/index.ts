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
    /** 页面名，浏览器标签里统一拼成「{title} · 岗位闯关式实训平台」 */
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
        meta: { nav: 'skill-tree', title: '岗位与技能体系' },
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
        // 历史记录入口在关卡地图的顶部工具条上，因此导航高亮跟地图保持一致
        path: 'map/history',
        name: 'map-history',
        component: () => import('@/views/HistoryView.vue'),
        meta: { nav: 'map', title: '历史记录' },
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

/**
 * 预热某个路径对应的路由组件。
 * 体积较大的页面（比如带 AntV G6 的技能树）在鼠标悬停导航时就开始加载，
 * 真正进入页面时就不用先等一段空白。
 */
export function prefetchRoute(path: string): void {
  const record = router.resolve(path).matched.at(-1)
  const loader = record?.components?.default
  if (typeof loader === 'function') void (loader as () => Promise<unknown>)()
}

export default router
