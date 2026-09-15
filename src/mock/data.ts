/**
 * Mock 数据：固定 seed、不随机，每次刷新结果一致，方便调试与复现问题。
 * 规模：6 个岗位 / 4 大技能体系 / 9 个实训项目 / 2 张已获得证书 + 1 个审核中认证。
 */

import type {
  CertificationOverview,
  ChatMessage,
  HistoryRecord,
  Position,
  Project,
  SkillSystem,
  StudentProfile,
  TeacherComment,
  TrainModule,
  TrainQuestion,
} from '@/types'

/* -------------------------------------------------------------------------- */
/* 学生                                                                        */
/* -------------------------------------------------------------------------- */

export const studentProfile: StudentProfile = {
  id: 'stu-2023210345',
  studentNo: '2023210345',
  name: '陈嘉禾',
  avatar: '陈',
  major: '人工智能技术应用',
  className: '23级人工智能2班',
  points: 3080,
  level: '高级',
  completionRate: 38,
  titles: ['工业视觉新星', '连续闯关 7 天', 'AI 判分满分记录'],
}

/* -------------------------------------------------------------------------- */
/* 岗位                                                                        */
/* -------------------------------------------------------------------------- */

export const positions: Position[] = [
  {
    id: 'pos-iv',
    name: '工业视觉检测工程师',
    icon: '🔍',
    direction: '工业视觉',
    difficulty: '较易',
    description: '面向 3C 与新能源产线，负责缺陷检测方案的光学设计、算法调参与现场调试，是产线质检的核心岗位。',
    levelFrom: '初级',
    levelTo: '中级',
    heat: 1286,
    selectedCount: 312,
    litSkillCount: 9,
    totalSkillCount: 13,
    finishedProjectCount: 2,
    matchRate: 69,
    selected: true,
  },
  {
    id: 'pos-dl',
    name: '深度学习算法工程师',
    icon: '🧠',
    direction: 'AI 训练',
    difficulty: '较难',
    description: '负责缺陷检测与分割模型的训练、评估与调优，处理小样本、类别不均衡等高难度工业数据问题。',
    levelFrom: '中级',
    levelTo: '高级',
    heat: 1524,
    selectedCount: 268,
    litSkillCount: 7,
    totalSkillCount: 14,
    finishedProjectCount: 1,
    matchRate: 50,
    selected: false,
  },
  {
    id: 'pos-qa',
    name: '视觉质量工程师',
    icon: '📐',
    direction: '工业视觉',
    difficulty: '中等',
    description: '定义视觉检测的判定口径与验收标准，负责成像质量评估、测量重复性与精度验证。',
    levelFrom: '初级',
    levelTo: '中级',
    heat: 842,
    selectedCount: 176,
    litSkillCount: 6,
    totalSkillCount: 12,
    finishedProjectCount: 1,
    matchRate: 50,
    selected: false,
  },
  {
    id: 'pos-edge',
    name: '边缘智能部署工程师',
    icon: '🛰️',
    direction: '智能装备',
    difficulty: '较难',
    description: '把训练好的模型落到工控机与边缘盒子上，负责推理加速、节拍优化与长时间稳定性验证。',
    levelFrom: '中级',
    levelTo: '高级',
    heat: 968,
    selectedCount: 154,
    litSkillCount: 5,
    totalSkillCount: 13,
    finishedProjectCount: 0,
    matchRate: 38,
    selected: false,
  },
  {
    id: 'pos-data',
    name: '数据标注与训练师',
    icon: '🏷️',
    direction: '数据工程',
    difficulty: '较易',
    description: '制定标注规范、构建高质量数据集并维护数据版本，是模型效果的第一道保障。',
    levelFrom: '入门',
    levelTo: '初级',
    heat: 1230,
    selectedCount: 402,
    litSkillCount: 5,
    totalSkillCount: 10,
    finishedProjectCount: 1,
    matchRate: 50,
    selected: false,
  },
  {
    id: 'pos-robot',
    name: '机器人视觉集成工程师',
    icon: '🦾',
    direction: '智能装备',
    difficulty: '中等',
    description: '负责机械臂与视觉系统的标定与联动，完成抓取定位、轨迹引导与产线联调。',
    levelFrom: '中级',
    levelTo: '中级',
    heat: 903,
    selectedCount: 188,
    litSkillCount: 4,
    totalSkillCount: 12,
    finishedProjectCount: 0,
    matchRate: 33,
    selected: false,
  },
]

/* -------------------------------------------------------------------------- */
/* 技能树：四大体系                                                            */
/* -------------------------------------------------------------------------- */

export const skillSystems: SkillSystem[] = [
  {
    id: 'optical',
    name: '光学成像系',
    color: '#35c2ff',
    nodes: [
      {
        id: 'sk-opt-01',
        name: '光学基础',
        systemId: 'optical',
        icon: '🔆',
        status: 'mastered',
        progress: { current: 1, total: 1 },
        description: '掌握成像链路与常见光源类型，能判断成像方案是否成立。',
        prerequisites: [],
        projectIds: ['p-03'],
      },
      {
        id: 'sk-opt-02',
        name: '镜头选型',
        systemId: 'optical',
        icon: '🔭',
        status: 'mastered',
        progress: { current: 1, total: 1 },
        description: '根据视野与精度反推焦距、工作距离与靶面尺寸。',
        prerequisites: ['光学基础'],
        projectIds: ['p-03'],
      },
      {
        id: 'sk-opt-03',
        name: '光源方案设计',
        systemId: 'optical',
        icon: '💡',
        status: 'active',
        progress: { current: 2, total: 3 },
        description: '针对划痕、脏污等缺陷设计明场、暗场与同轴光方案。',
        prerequisites: ['光学基础'],
        projectIds: ['p-01', 'p-08'],
      },
      {
        id: 'sk-opt-04',
        name: '相机参数调试',
        systemId: 'optical',
        icon: '🎛️',
        status: 'active',
        progress: { current: 1, total: 3 },
        description: '完成曝光、增益、触发方式的现场调试与固化。',
        prerequisites: ['镜头选型'],
        projectIds: ['p-08'],
      },
      {
        id: 'sk-opt-05',
        name: '成像质量评估',
        systemId: 'optical',
        icon: '📈',
        status: 'locked',
        progress: { current: 0, total: 2 },
        description: '用清晰度、对比度、畸变等指标量化成像质量。',
        prerequisites: ['相机参数调试'],
        projectIds: ['p-04'],
      },
      {
        id: 'sk-opt-06',
        name: '高反光与透明件成像',
        systemId: 'optical',
        icon: '💠',
        status: 'locked',
        progress: { current: 0, total: 3 },
        description: '解决金属、玻璃、亚克力等高反光材质的成像难点。',
        prerequisites: ['成像质量评估'],
        projectIds: ['p-04'],
      },
    ],
  },
  {
    id: 'algorithm',
    name: '传统算法系',
    color: '#8b7cff',
    nodes: [
      {
        id: 'sk-alg-01',
        name: '图像预处理',
        systemId: 'algorithm',
        icon: '🧽',
        status: 'mastered',
        progress: { current: 1, total: 1 },
        description: '滤波、去噪、对比度增强与 ROI 提取。',
        prerequisites: [],
        projectIds: ['p-01'],
      },
      {
        id: 'sk-alg-02',
        name: '边缘与轮廓提取',
        systemId: 'algorithm',
        icon: '✏️',
        status: 'mastered',
        progress: { current: 1, total: 1 },
        description: 'Canny、亚像素边缘与轮廓拟合。',
        prerequisites: ['图像预处理'],
        projectIds: ['p-02'],
      },
      {
        id: 'sk-alg-03',
        name: 'Blob 分析',
        systemId: 'algorithm',
        icon: '🔵',
        status: 'active',
        progress: { current: 2, total: 3 },
        description: '连通域统计与面积、周长、圆度特征筛选。',
        prerequisites: ['图像预处理'],
        projectIds: ['p-03', 'p-05'],
      },
      {
        id: 'sk-alg-04',
        name: '模板匹配',
        systemId: 'algorithm',
        icon: '🎯',
        status: 'active',
        progress: { current: 1, total: 3 },
        description: '形状与灰度模板匹配，输出定位坐标与角度。',
        prerequisites: ['边缘与轮廓提取'],
        projectIds: ['p-05', 'p-06'],
      },
      {
        id: 'sk-alg-05',
        name: '几何测量与标定',
        systemId: 'algorithm',
        icon: '📏',
        status: 'locked',
        progress: { current: 0, total: 3 },
        description: '像素当量标定与尺寸、位置度测量。',
        prerequisites: ['模板匹配'],
        projectIds: ['p-04', 'p-06'],
      },
      {
        id: 'sk-alg-06',
        name: '缺陷特征工程',
        systemId: 'algorithm',
        icon: '🧩',
        status: 'locked',
        progress: { current: 0, total: 2 },
        description: '从形态、灰度、纹理维度构造可判别特征。',
        prerequisites: ['Blob 分析'],
        projectIds: ['p-06'],
      },
      {
        id: 'sk-alg-07',
        name: '多相机标定',
        systemId: 'algorithm',
        icon: '🛰️',
        status: 'locked',
        progress: { current: 0, total: 2 },
        description: '多相机坐标系统一与联合标定。',
        prerequisites: ['几何测量与标定'],
        projectIds: ['p-07'],
      },
    ],
  },
  {
    id: 'deeplearning',
    name: '深度学习系',
    color: '#ff7ba8',
    nodes: [
      {
        id: 'sk-dl-01',
        name: '数据集构建',
        systemId: 'deeplearning',
        icon: '🗂️',
        status: 'active',
        progress: { current: 2, total: 3 },
        description: '划分训练/验证/测试集，控制类别与场景分布。',
        prerequisites: [],
        projectIds: ['p-08'],
      },
      {
        id: 'sk-dl-02',
        name: '标注规范制定',
        systemId: 'deeplearning',
        icon: '🏷️',
        status: 'mastered',
        progress: { current: 1, total: 1 },
        description: '定义缺陷边界、最小可标尺寸与一致性校验规则。',
        prerequisites: [],
        projectIds: ['p-03'],
      },
      {
        id: 'sk-dl-03',
        name: '分类模型训练',
        systemId: 'deeplearning',
        icon: '🧠',
        status: 'active',
        progress: { current: 1, total: 3 },
        description: '完成数据增强、训练配置与过拟合判断。',
        prerequisites: ['数据集构建'],
        projectIds: ['p-08'],
      },
      {
        id: 'sk-dl-04',
        name: '目标检测训练',
        systemId: 'deeplearning',
        icon: '🔎',
        status: 'locked',
        progress: { current: 0, total: 3 },
        description: '训练缺陷检测模型，输出类别、位置与置信度。',
        prerequisites: ['分类模型训练'],
        projectIds: ['p-06'],
      },
      {
        id: 'sk-dl-05',
        name: '模型评估与调参',
        systemId: 'deeplearning',
        icon: '⚖️',
        status: 'locked',
        progress: { current: 0, total: 3 },
        description: '用召回率、误检率与混淆矩阵定位模型短板。',
        prerequisites: ['目标检测训练'],
        projectIds: ['p-05', 'p-06'],
      },
      {
        id: 'sk-dl-06',
        name: '数据增强策略',
        systemId: 'deeplearning',
        icon: '🌀',
        status: 'locked',
        progress: { current: 0, total: 2 },
        description: '针对小样本缺陷设计合成与增强策略。',
        prerequisites: ['数据集构建'],
        projectIds: ['p-08'],
      },
      {
        id: 'sk-dl-07',
        name: '缺陷分割',
        systemId: 'deeplearning',
        icon: '🫧',
        status: 'locked',
        progress: { current: 0, total: 3 },
        description: '像素级分割不规则缺陷，输出面积占比。',
        prerequisites: ['模型评估与调参'],
        projectIds: ['p-08'],
      },
    ],
  },
  {
    id: 'deployment',
    name: '项目部署系',
    color: '#34d399',
    nodes: [
      {
        id: 'sk-dep-01',
        name: '推理加速',
        systemId: 'deployment',
        icon: '⚡',
        status: 'mastered',
        progress: { current: 1, total: 1 },
        description: '模型量化、剪枝与推理引擎选择。',
        prerequisites: [],
        projectIds: ['p-09'],
      },
      {
        id: 'sk-dep-02',
        name: '边缘设备部署',
        systemId: 'deployment',
        icon: '📦',
        status: 'active',
        progress: { current: 1, total: 3 },
        description: '在工控机与边缘盒子上完成环境搭建与模型上线。',
        prerequisites: ['推理加速'],
        projectIds: ['p-09'],
      },
      {
        id: 'sk-dep-03',
        name: '相机与设备联调',
        systemId: 'deployment',
        icon: '🔌',
        status: 'locked',
        progress: { current: 0, total: 3 },
        description: '打通触发、通信与结果回传链路。',
        prerequisites: ['边缘设备部署'],
        projectIds: ['p-07', 'p-09'],
      },
      {
        id: 'sk-dep-04',
        name: '产线节拍优化',
        systemId: 'deployment',
        icon: '⏱️',
        status: 'locked',
        progress: { current: 0, total: 2 },
        description: '在满足节拍的前提下平衡精度与耗时。',
        prerequisites: ['边缘设备部署'],
        projectIds: ['p-07'],
      },
      {
        id: 'sk-dep-05',
        name: '系统稳定性测试',
        systemId: 'deployment',
        icon: '🩺',
        status: 'locked',
        progress: { current: 0, total: 2 },
        description: '连续运行、异常恢复与日志留痕验证。',
        prerequisites: ['相机与设备联调'],
        projectIds: ['p-09'],
      },
      {
        id: 'sk-dep-06',
        name: '部署文档交付',
        systemId: 'deployment',
        icon: '📄',
        status: 'locked',
        progress: { current: 0, total: 1 },
        description: '输出部署手册、参数清单与验收记录。',
        prerequisites: ['系统稳定性测试'],
        projectIds: ['p-09'],
      },
    ],
  },
]

/* -------------------------------------------------------------------------- */
/* 实训项目：七步关卡由模板生成，前端不写死七步                                 */
/* -------------------------------------------------------------------------- */

interface StepSeed {
  name: string
  goal: string
  requirement: string
  description: string
  criteria: string[]
  weight: number
  questions: Omit<TrainQuestion, 'id'>[]
}

const STEP_LIBRARY: StepSeed[] = [
  {
    name: '需求分析',
    goal: '把「检测什么、判到什么程度」说清楚',
    requirement: '输出检测对象、缺陷类型与判定口径，并给出量化指标。',
    description: '与产线工艺方确认待检测对象、缺陷类型与验收口径，形成可执行的检测需求。',
    criteria: ['明确待检测对象与缺陷类型', '给出精度与节拍要求', '说明误检/漏检的可接受范围'],
    weight: 10,
    questions: [
      {
        label: '请描述待检测产品的外观、材质、尺寸等特征，以及需要检出的缺陷类型。',
        placeholder: '示例：亚克力板，透明材质，尺寸 120mm×80mm×3mm，需检出长度 ≥0.3mm 的划痕与边缘崩缺…',
        hint: '越具体越好，材质与表面处理会直接影响成像方案。',
        maxLength: 2000,
        required: true,
      },
      {
        label: '本次检测的判定口径与量化指标是什么？',
        placeholder: '示例：漏检率 ≤0.5%，误检率 ≤2%，单件检测节拍 ≤800ms…',
        maxLength: 1200,
        required: true,
      },
    ],
  },
  {
    name: '方案设计',
    goal: '给出成像与算法两条主线的方案',
    requirement: '说明相机、镜头、光源选型依据，以及算法路线与理由。',
    description: '基于需求确定成像方案与算法路线，说明关键选型参数与备选方案。',
    criteria: ['成像方案与缺陷特征匹配', '给出关键选型参数', '算法路线有对比与取舍说明'],
    weight: 15,
    questions: [
      {
        label: '请写出你的成像方案：相机、镜头、光源类型及关键参数，并说明选型依据。',
        placeholder: '示例：500 万像素工业相机 + 远心镜头（0.5×），配低角度环形光打暗场突出划痕…',
        maxLength: 2000,
        required: true,
      },
      {
        label: '算法路线如何选择？请对比至少两种方案并给出结论。',
        placeholder: '示例：传统算法响应快但对复杂纹理误检高；深度学习方法泛化好但需样本…最终选择…',
        maxLength: 2000,
        required: true,
      },
    ],
  },
  {
    name: '数据处理',
    goal: '得到可训练、可复现的数据集',
    requirement: '说明采集方式、标注规范、清洗与划分策略。',
    description: '完成图像采集与标注，形成训练/验证/测试数据集，并记录数据分布。',
    criteria: ['标注规范清晰可复现', '数据划分比例合理', '统计各类别样本分布'],
    weight: 15,
    questions: [
      {
        label: '简述你的数据采集与标注流程，以及标注规范中的关键约定。',
        placeholder: '示例：采集 1200 张，覆盖 3 种光照；划痕按最小外接矩形标注，含糊样本单独标记…',
        maxLength: 2000,
        required: true,
      },
      {
        label: '数据集如何划分？各类别样本量分布如何？',
        placeholder: '示例：训练 840 / 验证 180 / 测试 180，缺陷样本占比 23%…',
        maxLength: 1200,
        required: true,
      },
    ],
  },
  {
    name: '模型训练',
    goal: '把模型训练起来并给出可信的训练曲线',
    requirement: '说明模型结构、训练配置、关键超参与训练结果。',
    description: '完成模型训练，记录超参数配置与训练过程指标。',
    criteria: ['训练配置完整可复现', '给出训练/验证曲线', '说明收敛情况与问题'],
    weight: 20,
    questions: [
      {
        label: '请说明模型结构与训练配置（优化器、学习率、批次、轮次）。',
        placeholder: '示例：ResNet18 迁移学习，Adam lr=1e-3，batch=16，epoch=50，余弦退火…',
        maxLength: 2000,
        required: true,
      },
      {
        label: '训练过程中的指标变化如何？是否出现过拟合或欠拟合？',
        placeholder: '示例：第 12 轮后验证损失回升，判断为过拟合，随后引入增强与早停…',
        maxLength: 1500,
        required: true,
      },
    ],
  },
  {
    name: '模型优化',
    goal: '把不达标的指标拉回来',
    requirement: '针对短板提出优化措施，并给出前后对比数据。',
    description: '定位模型薄弱环节，通过数据、结构或策略手段完成优化。',
    criteria: ['优化措施针对明确问题', '提供优化前后对比', '说明副作用与代价'],
    weight: 15,
    questions: [
      {
        label: '当前模型的短板是什么？你采取了哪些优化措施？',
        placeholder: '示例：细长划痕召回仅 71%，采用高分辨率切图推理 + 难例挖掘…',
        maxLength: 2000,
        required: true,
      },
      {
        label: '优化前后的指标对比如何？付出了什么代价？',
        placeholder: '示例：召回 71%→92%，误检 3.4%→2.1%，单张推理耗时增加 18ms…',
        maxLength: 1500,
        required: true,
      },
    ],
  },
  {
    name: '模型测试',
    goal: '在真实产线条件下验证方案',
    requirement: '给出测试方案、样本规模与结论，覆盖边界与异常场景。',
    description: '在测试集与真实现场条件下验证模型表现，形成测试结论。',
    criteria: ['测试样本具备代表性', '覆盖边界与异常场景', '结论有数据支撑'],
    weight: 15,
    questions: [
      {
        label: '你的测试方案是什么？覆盖了哪些边界与异常场景？',
        placeholder: '示例：800 件在线测试，覆盖换批、换光、脏镜头、产品偏移等场景…',
        maxLength: 2000,
        required: true,
      },
      {
        label: '测试结论如何？是否达到验收指标？',
        placeholder: '示例：漏检率 0.4%、误检率 1.8%，单件节拍 760ms，全部达标…',
        maxLength: 1500,
        required: true,
      },
    ],
  },
  {
    name: '报告上传',
    goal: '交出可交付的成果包',
    requirement: '上传实训报告与关键成果文件，并做结论性总结。',
    description: '整理完整实训报告与过程文件，形成可交付成果。',
    criteria: ['报告结构完整', '关键数据与截图留存', '结论与建议明确'],
    weight: 10,
    questions: [
      {
        label: '请总结本次实训的技术路线、关键结论与遗留问题。',
        placeholder: '示例：采用暗场成像 + 分割网络，最终漏检 0.4%；遗留问题为高反光批次稳定性…',
        maxLength: 2000,
        required: true,
      },
    ],
  },
]

/** 生成本项目的七个关卡（含题干、验收标准、权重）。 */
function buildModules(projectId: string): { modules: TrainModule[]; totalWeight: number } {
  const modules = STEP_LIBRARY.map((step, stepIndex) => {
    const order = stepIndex + 1
    const moduleId = `${projectId}-m${order}`
    const questions: TrainQuestion[] = step.questions.map((question, questionIndex) => ({
      ...question,
      id: `${moduleId}-q${questionIndex + 1}`,
    }))
    return {
      id: moduleId,
      order,
      name: step.name,
      required: true,
      weight: step.weight,
      requirement: step.requirement,
      description: step.description,
      criteria: step.criteria,
      goal: step.goal,
      questions,
    } satisfies TrainModule
  })
  const totalWeight = modules.reduce((sum, module) => sum + module.weight, 0)
  return { modules, totalWeight }
}

interface ProjectSeed {
  id: string
  name: string
  tier: Project['tier']
  icon: string
  positionId: string
  status: Project['status']
  levelDone: number
  score?: number
  lockReason?: string
  intro: string
}

const PROJECT_SEEDS: ProjectSeed[] = [
  {
    id: 'p-01',
    name: '亚克力板划痕检测',
    tier: 'basic',
    icon: '🪟',
    positionId: 'pos-iv',
    status: 'completed',
    levelDone: 7,
    score: 92,
    intro: '从零完成一块透明亚克力板的划痕检测方案，是工业视觉最典型的入门实训。',
  },
  {
    id: 'p-02',
    name: '金属件表面缺陷分拣',
    tier: 'basic',
    icon: '🔩',
    positionId: 'pos-iv',
    status: 'completed',
    levelDone: 7,
    score: 88,
    intro: '针对金属件表面的划伤、凹坑与氧化斑，完成可落地的自动分拣方案。',
  },
  {
    id: 'p-03',
    name: '药片缺粒与色差检测',
    tier: 'basic',
    icon: '💊',
    positionId: 'pos-iv',
    status: 'in_progress',
    levelDone: 3,
    intro: '医药包装产线的经典检测场景：既要数得准，也要判得稳。',
  },
  {
    id: 'p-04',
    name: '高反光零件尺寸测量',
    tier: 'advanced',
    icon: '⚙️',
    positionId: 'pos-qa',
    status: 'in_progress',
    levelDone: 2,
    intro: '当零件表面像镜子一样反光，成像方案与标定精度决定成败。',
  },
  {
    id: 'p-05',
    name: '3C 外壳丝印字符识别',
    tier: 'advanced',
    icon: '🔤',
    positionId: 'pos-iv',
    status: 'not_started',
    levelDone: 0,
    intro: '定位、校正、识别三段式流程，考察你对模板匹配与识别的综合运用。',
  },
  {
    id: 'p-06',
    name: 'PCB 焊点缺陷检测',
    tier: 'advanced',
    icon: '🟩',
    positionId: 'pos-dl',
    status: 'locked',
    levelDone: 0,
    lockReason: '完成更多基础项目即可解锁',
    intro: '微小焊点的虚焊、连锡检测，是传统算法与深度学习的分水岭场景。',
  },
  {
    id: 'p-07',
    name: '多相机产线联动检测',
    tier: 'extended',
    icon: '🎥',
    positionId: 'pos-robot',
    status: 'locked',
    levelDone: 0,
    lockReason: '完成 2 个进阶项目即可解锁',
    intro: '多工位相机协同，处理坐标统一、触发同步与结果融合。',
  },
  {
    id: 'p-08',
    name: '小样本缺陷检测模型轻量化',
    tier: 'extended',
    icon: '🧬',
    positionId: 'pos-dl',
    status: 'not_started',
    levelDone: 0,
    intro: '样本只有几十张，还要跑得动——小样本与轻量化的双重挑战。',
  },
  {
    id: 'p-09',
    name: '产线级检测系统部署与交付',
    tier: 'extended',
    icon: '🏭',
    positionId: 'pos-edge',
    status: 'locked',
    levelDone: 0,
    lockReason: '完成「多相机产线联动检测」即可解锁',
    intro: '从模型到产线：部署、联调、压测与文档交付的完整闭环。',
  },
]

export const projects: Project[] = PROJECT_SEEDS.map((seed) => {
  const { modules } = buildModules(seed.id)
  const levelTotal = modules.length
  return {
    ...seed,
    levelTotal,
    progress: Math.round((seed.levelDone / levelTotal) * 100),
    modules,
    // 项目资料由教师端上传，Mock 里没有
    files: [],
  }
})

/* -------------------------------------------------------------------------- */
/* 历史记录与教师点评                                                          */
/* -------------------------------------------------------------------------- */

export const historyRecords: HistoryRecord[] = [
  {
    id: 'h-01',
    moduleId: 'p-03-m1',
    moduleName: '需求分析',
    at: '2026-09-06 14:20',
    summary: '明确了缺粒与色差的判定口径，补上了节拍要求',
    score: 90,
  },
  {
    id: 'h-02',
    moduleId: 'p-03-m2',
    moduleName: '方案设计',
    at: '2026-09-07 10:05',
    summary: '采用背光 + 同轴光组合，算法以 Blob 分析为主',
    score: 86,
  },
  {
    id: 'h-03',
    moduleId: 'p-03-m3',
    moduleName: '数据处理',
    at: '2026-09-08 16:42',
    summary: '完成 1200 张图像标注，色差样本单独归档',
    score: 84,
  },
]

export const teacherComments: TeacherComment[] = [
  {
    id: 'tc-01',
    moduleId: 'p-03-m2',
    teacher: '林工',
    at: '2026-09-07 09:12',
    moduleName: '方案设计',
    content: '光源方案思路正确。建议补充不同批次药片的反射差异说明，现场换批时更容易复现。',
  },
  {
    id: 'tc-02',
    moduleId: 'p-03-m3',
    teacher: '林工',
    at: '2026-09-08 18:30',
    moduleName: '数据处理',
    content: '标注规范写得比上一关细，继续保持。色差样本建议再补 50 张暗光条件。',
  },
]

/* -------------------------------------------------------------------------- */
/* 认证中心                                                                    */
/* -------------------------------------------------------------------------- */

export const certificationOverview: CertificationOverview = {
  conditions: [
    {
      id: 'cond-basic',
      name: '基础项目完成',
      icon: '🧱',
      requirement: '完成 5 个基础实训项目全部关卡',
      done: false,
      current: 2,
      total: 5,
      unit: '个',
      tone: 'brand',
    },
    {
      id: 'cond-advanced',
      name: '进阶项目完成',
      icon: '🚀',
      requirement: '完成 4 个进阶实训项目全部关卡',
      done: false,
      current: 2,
      total: 4,
      unit: '个',
      tone: 'wip',
    },
    {
      id: 'cond-skill',
      name: '技能树达标',
      icon: '🌳',
      requirement: '四大体系共掌握 12 项技能',
      done: false,
      current: 8,
      total: 12,
      unit: '项',
      tone: 'brand',
    },
  ],
  items: [
    {
      id: 'cert-01',
      positionName: '工业视觉检测工程师（初级）',
      icon: '🔍',
      status: 'obtained',
      obtainedAt: '2026-06-18',
      conditions: [
        { name: '基础项目完成', required: '5 个', current: '5 个', done: true },
        { name: '技能树达标', required: '12 项', current: '12 项', done: true },
        { name: '综合测评', required: '≥80 分', current: '92 分', done: true },
      ],
    },
    {
      id: 'cert-02',
      positionName: '机器视觉应用（工业）',
      icon: '📷',
      status: 'obtained',
      obtainedAt: '2025-12-20',
      conditions: [
        { name: '基础项目完成', required: '3 个', current: '3 个', done: true },
        { name: '技能树达标', required: '8 项', current: '8 项', done: true },
        { name: '综合测评', required: '≥70 分', current: '85 分', done: true },
      ],
    },
    {
      id: 'cert-03',
      positionName: '深度学习算法工程师（中级）',
      icon: '🧠',
      status: 'reviewing',
      conditions: [
        { name: '进阶项目完成', required: '4 个', current: '2 个', done: false },
        { name: '技能树达标', required: '14 项', current: '12 项', done: false },
        { name: '综合测评', required: '≥80 分', current: '待测评', done: false },
      ],
    },
  ],
}

/* -------------------------------------------------------------------------- */
/* AI 助教                                                                     */
/* -------------------------------------------------------------------------- */

export const chatQuota = {
  singleLimit: 500,
  dailyLimit: 50,
  used: 12,
}

export const chatSeed: ChatMessage[] = [
  {
    id: 'c-01',
    role: 'assistant',
    content:
      '你好，我是你的 AI 助教。当前你正在《药片缺粒与色差检测》的「模型训练」关卡，需要帮忙吗？',
    sources: [
      { title: '实训指导手册 · 第 4 章', snippet: '训练配置与过拟合判断的一般流程与常见坑位。' },
    ],
    createdAt: '2026-09-10 09:00',
  },
]

export const chatQuickQuestions = [
  '药片色差检测用传统算法还是深度学习更合适？',
  '小样本情况下怎么做数据增强？',
  '怎么判断模型是过拟合还是数据分布问题？',
]

export const chatReplies: { keywords: string[]; content: string; sources: { title: string; snippet: string }[] }[] =
  [
    {
      keywords: ['色差', '传统', '深度学习'],
      content:
        '色差属于颜色分布问题，先看样本量：若每类超过 300 张且色差形态稳定，传统算法（颜色空间转换 + 阈值/聚类）更快也更好解释；样本少或色差形态多变时，用深度学习方法做分类更稳。本次实训建议先用「背光 + 同轴光」把颜色差异放大，再决定路线。',
      sources: [
        { title: '工业视觉检测 · 光学方案库', snippet: '背光与同轴光对颜色与轮廓差异的强化对比。' },
        { title: '实训指导手册 · 第 2 章', snippet: '传统算法与深度学习的选型判断清单。' },
      ],
    },
    {
      keywords: ['小样本', '增强', '数据'],
      content:
        '小样本优先做「可控增强」：几何变换（旋转/平移/缩放）+ 光度变换（亮度/对比度/Gamma），不要一上来就用强形变，容易把缺陷特征也改掉。缺陷类样本建议配合合成缺陷（CutMix、贴图合成）补足，并在验证集上单独统计合成样本的贡献。',
      sources: [
        { title: '深度学习实训 · 数据增强策略', snippet: '工业小样本缺陷的增强优先级与禁忌。' },
      ],
    },
    {
      keywords: ['过拟合', '欠拟合', '泛化'],
      content:
        '看两条曲线的分叉时机：训练损失持续下降而验证损失回升即为过拟合，通常发生在样本少的类别上；若两条曲线都高且接近，则是欠拟合或学习率设置不当。另外，若验证集准确率波动很大，多半是数据分布问题（换批、换光），而不是模型容量问题。',
      sources: [
        { title: '实训指导手册 · 第 4 章', snippet: '训练曲线诊断表：过拟合 / 欠拟合 / 分布偏移。' },
      ],
    },
  ]

export const aiSuggestionPool = [
  '总结要点：把缺陷的边界定义写清楚，比堆术语更能拿分。',
  '建议补充量化指标（漏检率、误检率、节拍），评审会重点看这一项。',
  '如果现场条件允许，补一组换批样本能显著提升方案的可靠性。',
]
