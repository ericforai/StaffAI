import type { RequirementDraft } from '../shared/intent-types';

export class PlanGenerationService {
  async generatePlan(draft: RequirementDraft): Promise<RequirementDraft> {
    const now = new Date().toISOString();
    
    // Simulate smart plan generation based on requirements
    // In a real scenario, this would be an LLM call
    const scenario = draft.rawInput.toLowerCase().includes('frontend') || draft.rawInput.toLowerCase().includes('ui') 
      ? 'frontend_implementation' 
      : 'full-stack-dev';

    draft.implementationPlan = {
      scenario: 'feature-delivery',
      steps: [
        { 
          id: 'step_1', 
          order: 1,
          role: 'sprint-prioritizer', 
          goal: '产品澄清 (Product): 完善 PRD 摘要，明确目标用户和验收标准。',
          input: '设计摘要 (Design Summary)',
          verification: '输出 PRD 摘要文档',
          approvalRequired: true
        },
        { 
          id: 'step_2', 
          order: 2,
          role: 'software-architect', 
          goal: '架构设计 (Architect): 拆分前后端边界，定义核心接口和模块关系。',
          input: 'PRD 摘要',
          verification: '输出架构说明书与接口定义',
          approvalRequired: true
        },
        { 
          id: 'step_3', 
          order: 3,
          role: 'frontend-developer', 
          goal: '前端开发 (Frontend): 实现交互流程、页面结构及状态流。',
          input: '架构说明书',
          verification: '前端组件与交互逻辑通过验证',
          approvalRequired: false
        },
        { 
          id: 'step_4', 
          order: 4,
          role: 'backend-architect', 
          goal: '后端开发 (Backend): 实现数据模型、业务逻辑及 API 接口。',
          input: '架构说明书',
          verification: 'API 接口测试通过，数据持久化正常',
          approvalRequired: false
        },
        { 
          id: 'step_5', 
          order: 5,
          role: 'security-engineer', 
          goal: '安全审计 (Security): 审查权限边界、风险动作并拦截敏感操作。',
          input: '前后端代码及配置',
          verification: '生成安全审查报告，确认无高危风险',
          approvalRequired: true
        },
        { 
          id: 'step_6', 
          order: 6,
          role: 'code-reviewer', 
          goal: '最终评审 (Review): 汇总所有产物，给出合并与发布建议。',
          input: '全套开发产出',
          verification: '最终验收测试通过，输出总评报告',
          approvalRequired: true
        }
      ],
      recommendedAutonomyLevel: 'L2',
      estimatedComplexity: 'Medium',
    };
    
    draft.status = 'plan_ready';
    draft.suggestedAutonomyLevel = 'L2';
    draft.suggestedScenario = scenario;
    draft.updatedAt = now;
    
    return draft;
  }
}
