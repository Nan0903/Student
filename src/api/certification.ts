/** 认证中心 */

import { mockRequest } from '@/utils/request'
import { certificationOverview } from '@/mock/data'
import type { CertificationOverview } from '@/types'

export function fetchCertificationOverview(): Promise<CertificationOverview> {
  return mockRequest({ resolve: () => certificationOverview })
}
