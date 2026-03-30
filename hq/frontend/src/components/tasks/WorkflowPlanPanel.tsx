'use client';

import { formatWorkflowPlanMode, formatWorkflowStepStatus, formatAssignmentRole } from '../../utils/formatters';
import type { WorkflowPlan } from '../../types';

interface WorkflowPlanPanelProps {
  workflowPlan: WorkflowPlan | null;
}

export function WorkflowPlanPanel({ workflowPlan }: WorkflowPlanPanelProps) {
  return (
    <div className="rounded-[1.4rem] border border-slate-200 bg-[#fcfaf5] p-4">
      <p className="text-[11px] tracking-[0.2em] text-slate-500">工作计划</p>
      {workflowPlan ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-sky-50 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-sky-700">
              {formatWorkflowPlanMode(workflowPlan.mode)}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-slate-600">
              {workflowPlan.steps.length} 步骤
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-slate-600">
              {workflowPlan.synthesisRequired ? '需要综合' : '无需综合'}
            </span>
          </div>

          <div className="space-y-2">
            {workflowPlan.steps.length === 0 && (
              <p className="text-sm text-slate-500">当前计划还没有拆出步骤。</p>
            )}
            {workflowPlan.steps.map((step, index) => (
              <div key={step.id} className="rounded-[1.1rem] border border-slate-200 bg-white px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {index + 1}. {step.title}
                    </p>
                    {step.description && <p className="mt-1 text-xs leading-6 text-slate-600">{step.description}</p>}
                  </div>
                  <span className="text-[10px] font-black tracking-[0.16em] text-slate-500">
                    {formatWorkflowStepStatus(step.status)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black tracking-[0.16em] text-slate-500">
                  {step.assignmentRole && (
                    <span className="rounded-full bg-slate-100 px-2 py-1">{formatAssignmentRole(step.assignmentRole)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          这个任务还没有生成工作计划，创建或执行后会在这里展示。
        </p>
      )}
    </div>
  );
}
