'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { DEPT_MAP } from '../../utils/constants';
import type { Agent } from '../../types';

interface AgentSelectorProps {
  agents: Agent[];
  activeIds: string[];
  selectedId: string;
  selectedName: string;
  onSelect: (id: string, name: string) => void;
  error?: boolean;
}

export function AgentSelector({
  agents,
  activeIds,
  selectedId,
  selectedName,
  onSelect,
  error
}: AgentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());

  // 切换部门展开/收起
  function toggleDepartment(dept: string) {
    setExpandedDepartments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dept)) {
        newSet.delete(dept);
      } else {
        newSet.add(dept);
      }
      return newSet;
    });
  }

  // 按部门分组活跃员工
  const agentsByDepartment = useMemo(() => {
    const grouped: Record<string, typeof agents> = {};
    agents
      .filter(agent => activeIds.includes(agent.id))
      .forEach(agent => {
        const dept = agent.department || 'specialized';
        if (!grouped[dept]) {
          grouped[dept] = [];
        }
        grouped[dept].push(agent);
      });
    return grouped;
  }, [agents, activeIds]);

  return (
    <div className="mt-3">
      <label className="block text-xs font-medium text-slate-700 mb-2">
        负责人 <span className="text-rose-500">*</span>
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 text-base text-left transition-colors ${
            isOpen ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <span className={selectedId ? 'text-slate-800' : 'text-slate-400'}>
            {selectedName || '请选择负责人'}
          </span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-64 overflow-y-auto">
            {Object.keys(agentsByDepartment).length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-sm text-slate-500">暂无可用员工</p>
                <Link
                  href="/organization"
                  className="mt-2 inline-block text-xs font-medium text-sky-600 hover:text-sky-700"
                  onClick={() => setIsOpen(false)}
                >
                  前往组织架构 →
                </Link>
              </div>
            ) : (
              Object.entries(agentsByDepartment).map(([dept, deptAgents]) => {
                const deptInfo = DEPT_MAP[dept];
                const DeptIcon = deptInfo?.icon;
                const isExpanded = expandedDepartments.has(dept);
                return (
                  <div key={dept} className="border-b border-slate-100 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => toggleDepartment(dept)}
                      className="flex w-full items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {DeptIcon && <DeptIcon className={`h-4 w-4 ${deptInfo?.color}`} />}
                        <span className="text-xs font-semibold text-slate-700">{deptInfo?.label || dept}</span>
                        <span className="text-xs text-slate-400">({deptAgents.length})</span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="border-t border-slate-100">
                        {deptAgents.map(agent => (
                          <button
                            key={agent.id}
                            type="button"
                            onClick={() => {
                              onSelect(agent.id, agent.frontmatter?.name || agent.id);
                              setIsOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-sky-50 transition-colors ${
                              selectedId === agent.id ? 'bg-sky-100 text-sky-700' : 'text-slate-600'
                            }`}
                          >
                            <span className="text-sm">{agent.frontmatter?.name}</span>
                            <span className="ml-auto text-xs text-slate-400">{agent.frontmatter?.emoji}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
      {error && !selectedId && (
        <p className="mt-1.5 text-xs text-rose-500">请先选择负责人</p>
      )}
    </div>
  );
}
