'use client';

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { formatWorkflowStepStatus, formatAssignmentRole } from '../../utils/formatters';
import { formatTimestamp } from '../../utils/dateFormatter';
import type { TaskAssignment, Agent } from '../../types';

interface AssignmentPanelProps {
  assignments: TaskAssignment[];
  agents: Agent[];
}

export function AssignmentPanel({ assignments, agents }: AssignmentPanelProps) {
  return (
    <div className="rounded-[1.4rem] border border-slate-200 bg-[#fcfaf5] p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] tracking-[0.2em] text-slate-500">任务分配</p>
        {assignments.length > 0 && (
          <Link
            href="/market"
            className="text-[10px] font-medium text-sky-600 hover:text-sky-700"
          >
            + 添加专家
          </Link>
        )}
      </div>
      {assignments.length > 0 ? (
        <div className="mt-3 space-y-2">
          {assignments.map((assignment) => {
            // 检查专家是否真实存在于组织架构中
            const agentExists = agents.some(a => a.id === assignment.agentId);
            const isMissingAgent = !agentExists && !assignment.agentName;

            return (
              <div
                key={assignment.id}
                className={`rounded-[1.1rem] border px-3 py-3 ${
                  isMissingAgent ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-black ${isMissingAgent ? 'text-amber-900' : 'text-slate-900'}`}>
                        {assignment.agentName || assignment.agentId}
                      </p>
                      {isMissingAgent && (
                        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          未聘用
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {assignment.assignmentRole || '未命名角色'}
                    </p>
                    {isMissingAgent && (
                      <div className="mt-2 rounded-md bg-amber-100 px-3 py-2">
                        <div className="flex items-center gap-2 text-amber-800">
                          <AlertCircle className="h-4 w-4" />
                          <p className="text-xs font-medium">组织中没有此类型专家，请先去人才市场聘用</p>
                        </div>
                        <Link
                          href="/market"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-800"
                        >
                          前往人才市场 →
                        </Link>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-black tracking-[0.16em] text-slate-500">
                    {formatWorkflowStepStatus(assignment.status)}
                  </span>
                </div>
                {assignment.resultSummary && !isMissingAgent && (
                  <p className="mt-2 text-xs leading-6 text-slate-600">{assignment.resultSummary}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black tracking-[0.16em] text-slate-500">
                  {assignment.startedAt && <span className="rounded-full bg-slate-100 px-2 py-1">开始 {formatTimestamp(assignment.startedAt)}</span>}
                  {assignment.endedAt && <span className="rounded-full bg-slate-100 px-2 py-1">结束 {formatTimestamp(assignment.endedAt)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          当前没有可展示的任务分配记录，系统会在生成 workflow plan 后补充。
        </p>
      )}
    </div>
  );
}
