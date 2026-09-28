/** 认证中心（真实后端） */

import { get, post } from './http'
import { requireStudentId } from './session'

export interface CertificateSkill {
  skill_node_id: number
  node_name: string
  description: string | null
  progress: number
  lit: boolean
}

export type CertificateApplyStatus = 'PENDING_INTERVIEW' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'

export interface CertificateApplication {
  id: number
  status: CertificateApplyStatus
  interview_note: string | null
  review_comment: string | null
}

export interface CertificationItem {
  certificate_rule_id: number
  job_id: number
  job_name: string | null
  cert_name: string
  issue_org_name: string | null
  description: string | null
  skill_total: number
  skill_done: number
  lit: boolean
  skills: CertificateSkill[]
  application: CertificateApplication | null
}

export interface CertificationOverview {
  student_id: number
  items: CertificationItem[]
}

export interface IssuedCertificate {
  id: number
  job_id: number
  job_name: string | null
  cert_name: string
  issue_org_name: string | null
  certificate_no: string
  issue_date: string | null
  status: string
}

export function fetchCertificationOverview(): Promise<CertificationOverview> {
  return get<CertificationOverview>(`/students/${requireStudentId()}/certifications`)
}

export function fetchIssuedCertificates(): Promise<IssuedCertificate[]> {
  return get<IssuedCertificate[]>(`/students/${requireStudentId()}/certificates`)
}

export function applyCertificate(certificateRuleId: number): Promise<CertificateApplication> {
  return post<CertificateApplication>(`/students/${requireStudentId()}/cert-applications`, {
    body: { certificate_rule_id: certificateRuleId },
  })
}

export function takeInterview(
  applicationId: number,
): Promise<CertificateApplication> {
  return post<CertificateApplication>(
    `/students/${requireStudentId()}/cert-applications/${applicationId}/interview`,
  )
}
