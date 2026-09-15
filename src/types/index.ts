/**
 * 全局数据契约。
 * 页面只依赖这里的类型；后端接入时替换 src/api 的内部实现即可，页面不用改。
 */

/* -------------------------------------------------------------------------- */
/* 身份                                                                        */
/* -------------------------------------------------------------------------- */

export type UserRole = 'student' | 'teacher'

/** 学生信息（顶部信息条 + 学生信息模块） */
export interface StudentProfile {
  id: string
  /** 学号（脱敏展示用） */
  studentNo: string
  name: string
  avatar: string
  /** 专业，如「人工智能技术应用」 */
  major: string
  /** 班级，如「23级人工智能2班」 */
  className: string
  /** 累计积分 */
  points: number
  /** 实训等级，如「高级」 */
  level: string
  /** 完成率 0-100 */
  completionRate: number
  /** 获得称号 */
  titles: string[]
}

export interface LoginResult {
  token: string
  role: UserRole
  profile: StudentProfile | null
}

/* -------------------------------------------------------------------------- */
/* 岗位                                                                        */
/* -------------------------------------------------------------------------- */

export type PositionDifficulty = '较易' | '中等' | '较难'

export interface Position {
  id: string
  name: string
  /** 岗位方向标签：工业视觉 / AI 训练 … */
  direction: string
  difficulty: PositionDifficulty
  description: string
  /** 等级区间，如 初级 → 中级 */
  levelFrom: string
  levelTo: string
  /** 热度 */
  heat: number
  /** 已选人数 / 通过人数 */
  selectedCount: number
  /**
   * 岗位由哪些技能点构成（技能点 id 列表）。
   * 岗位匹配度取这些技能点进度的均值，页面不再接受手工填写的匹配度。
   */
  skillIds: string[]
  /** 是否为当前已选岗位 */
  selected: boolean
}

/** 岗位进度画像：全部由技能点进度推导，不落库 */
export interface PositionProgress {
  /** 匹配度 0-100：岗位技能点的平均进度 */
  percent: number
  /** 岗位涉及的技能点总数 */
  skillTotal: number
  /** 其中已 100% 完成的技能点数 */
  skillDone: number
  /** 岗位下挂靠的项目总数 */
  projectTotal: number
  /** 其中已全部通关的项目数 */
  projectDone: number
}

/** 带进度画像的岗位视图，列表与卡片直接使用 */
export interface PositionView extends Position, PositionProgress {}

/* -------------------------------------------------------------------------- */
/* 技能树                                                                      */
/* -------------------------------------------------------------------------- */

export type SkillSystemId = 'optical' | 'algorithm' | 'deeplearning' | 'deployment'

export interface SkillNode {
  id: string
  name: string
  systemId: SkillSystemId
  /** 技能点说明 */
  description: string
}

/**
 * 技能点进度：由挂靠项目的完成度推导，不在数据里写死。
 * 一个项目可以挂靠多个技能点，一个技能点也可以由多个项目共同训练。
 */
export interface SkillProgress {
  /** 0-100：挂靠项目的平均完成度 */
  percent: number
  /** 挂靠项目总数 */
  projectTotal: number
  /** 其中已全部通关的项目数 */
  projectDone: number
}

export interface SkillSystem {
  id: SkillSystemId
  name: string
  color: string
  nodes: SkillNode[]
}

export interface SkillTreeStats {
  /** 技能点总数 */
  total: number
  /** 已 100% 完成的技能点数 */
  done: number
  /** 全部技能点的平均进度 0-100 */
  percent: number
}

/* -------------------------------------------------------------------------- */
/* 实训项目与关卡                                                               */
/* -------------------------------------------------------------------------- */

export type ProjectTier = 'basic' | 'advanced' | 'extended'
export type ProjectStatus = 'not_started' | 'in_progress' | 'completed' | 'locked'
export type ModuleStatus = 'draft' | 'submitted' | 'passed' | 'rejected'

export interface TrainModule {
  id: string
  order: number
  /** 需求分析 / 方案设计 / 数据处理 / 模型训练 / 模型优化 / 模型测试 / 报告上传 */
  name: string
  required: boolean
  /** 分值占比 */
  weight: number
  /** 作答要求 */
  requirement: string
  /** 任务描述 */
  description: string
  /** 验收标准 */
  criteria: string[]
  /** 本关目标（副标题） */
  goal: string
  /** 作答题干 */
  questions: TrainQuestion[]
}

export interface TrainQuestion {
  id: string
  label: string
  placeholder: string
  /** 说明文案 */
  hint?: string
  maxLength: number
  required: boolean
}

export interface UploadFile {
  id: string
  name: string
  size: number
  type: string
  url?: string
  uploadedAt: string
}

export interface Project {
  id: string
  name: string
  tier: ProjectTier
  positionId: string
  /** 本项目挂靠的技能点（多对多：一个项目可覆盖多个技能点） */
  skillIds: string[]
  status: ProjectStatus
  /** 关卡总数 */
  levelTotal: number
  /** 已完成关卡数 */
  levelDone: number
  /** 0-100 */
  progress: number
  /** 已通过时的得分 */
  score?: number
  /** 未解锁原因 */
  lockReason?: string
  /** 项目引导语 */
  intro: string
  modules: TrainModule[]
}

/** 项目卡上的技能点小标签：名称 + 所属体系取色 */
export interface ProjectSkillTag {
  id: string
  name: string
  color: string
}

/* -------------------------------------------------------------------------- */
/* 关卡作答与提交                                                               */
/* -------------------------------------------------------------------------- */

export interface AiReviewDimension {
  name: string
  score: number
  reason: string
  passed: boolean
}

export type AiReviewStatus = 'passed' | 'pending_recheck' | 'rechecked'

export interface AiReview {
  totalScore: number
  /** 优秀 / 良好 / 合格 */
  grade: string
  dimensions: AiReviewDimension[]
  suggestion: string
  reviewStatus: AiReviewStatus
  /** 教师复审结果 */
  teacherScore?: number
  teacherComment?: string
}

export interface ModuleSubmission {
  moduleId: string
  /** 按题目 id 存储 */
  textAnswers: Record<string, string>
  files: UploadFile[]
  status: ModuleStatus
  submittedAt?: string
  aiReview?: AiReview
}

export interface SubmitModulePayload {
  projectId: string
  moduleId: string
  textAnswers: Record<string, string>
  files: UploadFile[]
}

export interface HistoryRecord {
  id: string
  moduleId: string
  moduleName: string
  at: string
  summary: string
  score: number
}

export interface TeacherComment {
  id: string
  moduleId: string
  teacher: string
  at: string
  content: string
  moduleName: string
}

/* -------------------------------------------------------------------------- */
/* 认证                                                                        */
/* -------------------------------------------------------------------------- */

export type CertificationStatus = 'obtained' | 'reviewing' | 'not_met'

export interface CertificationCondition {
  name: string
  required: string
  current: string
  done: boolean
}

export interface Certification {
  id: string
  positionName: string
  status: CertificationStatus
  obtainedAt?: string
  conditions: CertificationCondition[]
}

export interface CertificationOverview {
  /** 认证条件三卡 */
  conditions: CertificationConditionCard[]
  items: Certification[]
}

export interface CertificationConditionCard {
  id: string
  name: string
  requirement: string
  done: boolean
  current: number
  total: number
  unit: string
  tone: 'brand' | 'ok' | 'wip'
}

/* -------------------------------------------------------------------------- */
/* AI 问答                                                                     */
/* -------------------------------------------------------------------------- */

export interface ChatSource {
  title: string
  snippet: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** 知识库来源标注 */
  sources?: ChatSource[]
  createdAt: string
  /** 发送失败可重试 */
  failed?: boolean
}

export interface ChatQuota {
  /** 单条字数上限 */
  singleLimit: number
  /** 每日次数上限 */
  dailyLimit: number
  /** 今日已用 */
  used: number
}

/* -------------------------------------------------------------------------- */
/* 其它                                                                        */
/* -------------------------------------------------------------------------- */

export interface NavItem {
  key: string
  label: string
  path: string
}
