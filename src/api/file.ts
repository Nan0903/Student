/**
 * 文件相关接口（对接 training_platform 的文件存储）。
 *
 * - 上传：`POST /api/file-assets/upload`（multipart）→ 文件落存储、元数据进 file_asset
 * - 下载：`GET /api/file-assets/{id}/download`（返回文件流，不包统一响应体）
 * - 关卡附件：`GET/POST/DELETE /api/attempts/{aid}/stages/{sid}/files[/{asset_id}]`
 */

import { API_BASE_URL } from '@/config/env'
import { getToken } from '@/utils/storage'
import { ApiError, del, get, post } from './http'
import type { UploadFile } from '@/types'

interface BackendFileAsset {
  id: number
  original_name: string
  content_type: string | null
  size_bytes: number
  biz_type: string
  created_at: string
}

interface Envelope {
  code?: number
  data?: unknown
  msg?: string
}

/**
 * 后端返回的 `download_url` 形如 `/api/file-assets/1/download`。
 * 运行时 API 前缀可能是 `/api`（开发走 vite 代理）或完整地址，这里统一还原。
 */
export function resolveApiPath(path: string): string {
  const prefix = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL
  const suffix = path.startsWith('/api') ? path.slice(4) : path
  return `${prefix}${suffix}`
}

function toUploadFile(asset: BackendFileAsset): UploadFile {
  return {
    id: String(asset.id),
    name: asset.original_name,
    size: asset.size_bytes,
    type: asset.content_type ?? 'file',
    url: resolveApiPath(`/api/file-assets/${asset.id}/download`),
    uploadedAt: asset.created_at,
  }
}

/**
 * 上传文件并登记台账，返回文件 ID。
 *
 * 用 XHR 而不是 fetch：只有 XHR 能拿到上传进度（页面上那根进度条要真实数据）。
 */
export function uploadFile(
  file: File,
  options: { bizType?: string; onProgress?: (percent: number) => void } = {},
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    form.append('biz_type', options.bizType ?? 'SUBMISSION')

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}/file-assets/upload`)
    const token = getToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () => {
      let payload: Envelope | null = null
      try {
        payload = JSON.parse(xhr.responseText) as Envelope
      } catch {
        payload = null
      }
      if (!payload) {
        reject(new ApiError(xhr.status, `上传失败：服务返回了非 JSON 内容（HTTP ${xhr.status}）`))
        return
      }
      const code = payload.code ?? xhr.status
      if (code !== 200) {
        reject(new ApiError(code, payload.msg || '上传失败，请稍后重试'))
        return
      }
      const asset = payload.data as BackendFileAsset
      resolve(String(asset.id))
    }
    xhr.onerror = () => reject(new ApiError(500, '上传失败：网络异常'))
    xhr.onabort = () => reject(new ApiError(499, '上传已取消'))
    xhr.send(form)
  })
}

/** 某一关已经挂上的附件 */
export async function fetchStageFiles(attemptId: string, stageId: string): Promise<UploadFile[]> {
  const assets = await get<BackendFileAsset[]>(`/attempts/${attemptId}/stages/${stageId}/files`)
  return assets.map(toUploadFile)
}

/** 把已上传的文件挂到本关作答上 */
export async function attachStageFile(
  attemptId: string,
  stageId: string,
  fileAssetId: string,
): Promise<void> {
  await post(`/attempts/${attemptId}/stages/${stageId}/files/${fileAssetId}`)
}

/** 解除本关作答的附件（文件台账与磁盘文件保留） */
export async function detachStageFile(
  attemptId: string,
  stageId: string,
  fileAssetId: string,
): Promise<void> {
  await del(`/attempts/${attemptId}/stages/${stageId}/files/${fileAssetId}`)
}
