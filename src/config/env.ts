/**
 * 运行环境配置：后端地址与演示账号。
 *
 * 开发时 `/api` 由 vite 代理转发到 training_platform（见 vite.config.ts），
 * 部署时保持同源反向代理即可，无需改代码；需要直连时用 VITE_API_BASE_URL 覆盖。
 */

/** 后端 API 前缀 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api'

/**
 * 演示登录用的学号。
 *
 * 后端目前没有登录/SSO 接口（属于后续阶段），学生端先用这个学号查真实学生档案，
 * 登录后所有 `/students/{id}/...` 请求都落在这个学生身上。
 */
export const DEMO_STUDENT_NO: string = import.meta.env.VITE_DEMO_STUDENT_NO ?? '2024010101'
