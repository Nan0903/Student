import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

import 'element-plus/dist/index.css'
import '@/assets/styles/tokens.css'
import '@/assets/styles/base.css'

import App from './App.vue'
import router from './router'
import { clearAuth, getProfile } from '@/utils/storage'
import type { StudentProfile } from '@/types'

/**
 * 清理旧版本（Mock 时期）遗留的登录态。
 *
 * 那时学生 id 形如 `stu-2023210345`，而真实后端主键是整型，
 * 带着这种脏数据进入页面会让所有 `/students/{id}/...` 请求被后端判成
 * 「Input should be a valid integer」而全部失败。启动时先清掉，交给路由守卫回登录页。
 */
function dropStaleSession(): void {
  const cached = getProfile<StudentProfile>()
  if (cached && !/^\d+$/.test(cached.id)) clearAuth()
}

const app = createApp(App)

dropStaleSession()

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })

app.mount('#app')
