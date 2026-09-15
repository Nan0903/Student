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
  icon: string
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
  /** 已点亮技能数 */
  litSkillCount: number
  /** 已点亮技能总数（用于匹配度展示） */
  totalSkillCount: number
  finishedProjectCount: number
  /** 匹配度 0-100（岗位推荐用） */
  matchRate: number
  /** 是否为当前已选岗位 */
  selected: boolean
}

/* -------------------------------------------------------------------------- */
/* 技能树                                                                      */
/* -------------------------------------------------------------------------- */

/** 技能体系 ID：由后端 skill_tree 主键决定，不再是固定枚举（教师端可新增体系） */
export type SkillSystemId = string

export type SkillNodeStatus = 'locked' | 'active' | 'mastered'

export interface SkillNode {
  id: string
  name: string
  systemId: SkillSystemId
  icon: string
  status: SkillNodeStatus
  /** 点亮进度；接入真实数据后 current/total 即「进度百分比」，如 50/100 */
  progress: { current: number; total: number }
  /** 简要解锁说明 */
  description: string
  /** 前置条件（技能名） */
  prerequisites: string[]
  /** 关联实训项目，未解锁时「前往实训」跳转用 */
  projectIds: string[]
}

export interface SkillSystem {
  id: SkillSystemId
  name: string
  color: string
  nodes: SkillNode[]
}

export interface SkillTreeStats {
  active: number
  mastered: number
  total: number
}

/* -------------------------------------------------------------------------- */
/* 实训项目与关卡                                                               */
/* -------------------------------------------------------------------------- */

export type ProjectTier = 'basic' | 'advanced' | 'extended'
/** submitted = 已整单提交、等待评审（后端 student_project.status = SUBMITTED） */
export type ProjectStatus = 'not_started' | 'in_progress' | 'submitted' | 'completed' | 'locked'
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
  icon: string
  positionId: string
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
  /** 项目资料（报告模板 / 数据文件 / 说明文档），由教师端上传 */
  files: ProjectFile[]
}

/** 项目附件用途 */
export type ProjectFileKind = 'REPORT_TEMPLATE' | 'DATASET' | 'GUIDE' | 'OTHER'

export interface ProjectFile {
  id: string
  fileKind: ProjectFileKind
  /** 展示名称，教师没填时用文件名 */
  title: string
  originalName: string
  contentType: string
  sizeBytes: number
  /** 可直接访问的下载地址 */
  downloadUrl: string
  remark?: string
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

/**
 * 判分/评审状态：
 * - saved：本关作答已保存（整单还没交，AI 判分未接入）
 * - pending：整单已提交，等待评审
 * - passed / failed：AI 评审已出结论
 * - pending_recheck：学生已提异议，等教师复核
 * - rechecked：教师已复审
 */
export type AiReviewStatus = 'saved' | 'pending' | 'passed' | 'failed' | 'pending_recheck' | 'rechecked'

export interface AiReview {
  totalScore?: number
  /** 优秀 / 良好 / 合格 */
  grade?: string
  dimensions: AiReviewDimension[]
  suggestion?: string
  reviewStatus: AiReviewStatus
  /** 教师复审结果 */
  teacherScore?: number
  teacherComment?: string
  /** 整单提交状态（后端 project_submission.status） */
  submissionStatus?: SubmissionStatus
  /** 提交记录 ID，撤回与提异议用 */
  submissionId?: string
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
  /** 该轮整单得分；还没出评审结果时为空 */
  score?: number
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
/* 闯关（对接后端后新增）                                                       */
/* -------------------------------------------------------------------------- */

/** 整单提交状态（project_submission.status） */
export type SubmissionStatus =
  | 'PENDING_AI'
  | 'AI_PASSED'
  | 'AI_FAILED'
  | 'PENDING_REVIEW'
  | 'REVIEWING'
  | 'REVIEWED'
  | 'WITHDRAWN'

/** 某一关的作答（attempt_stage） */
export interface StageAnswer {
  /** attempt_stage.id：保存作答用 */
  stageId: string
  /** project_module.id：与 TrainModule.id 一致 */
  moduleId: string
  order: number
  name: string
  required: boolean
  weight: number
  isFilled: boolean
  /** 后端只有这一个文本字段，多题作答按「【标题】+ 内容」拼在里面，见 utils/answer.ts */
  answerText: string
  /** 本关的填写引导子标题（教师手填） */
  items: StageGuideItem[]
  /** 本关作答最后填写时间（后端 attempt_stage.filled_at） */
  filledAt?: string
  fileCount: number
}

/** 关卡填写引导子标题（project_module.items_json） */
export interface StageGuideItem {
  title: string
  prompt: string
}

/** 一轮闯关 + 提交 + 评审的完整上下文 */
export interface ProjectWork {
  projectId: string
  /** NONE = 还没开始闯关 */
  status: 'NONE' | 'IN_PROGRESS' | 'SUBMITTED' | 'COMPLETED' | 'ABANDONED'
  attemptId: string | null
  attemptNo: number
  stages: StageAnswer[]
  submissionId: string | null
  submissionStatus: SubmissionStatus | null
  objection: string | null
  review: AiReview | null
  history: HistoryRecord[]
  comments: TeacherComment[]
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
  icon: string
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
  icon: string
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
  /** 左侧栏分组标题 */
  group?: string
}
