'use client';

import { ShieldAlert, CheckCircle2, XCircle, Clock, ExternalLink } from 'lucide-react';
import type { Approval } from '../../types/domain';

interface Props {
  approval: Approval;
  onApprove: (reason?: string) => Promise<void>;
  onReject: (reason?: string) => Promise<void>;
  loading?: boolean;
}

export function ApprovalDetailPanel({ approval, onApprove, onReject, loading }: Props) {
  const isHighRisk = approval.riskLevel === 'HIGH';
  const isPending = approval.status === 'pending';

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`px-6 py-4 flex items-center justify-between ${isHighRisk ? 'bg-red-50' : 'bg-slate-50'}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isHighRisk ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-600'}`}>
            <ShieldAlert size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
              {approval.approvalType?.replace('_', ' ') || '审批请求'}
            </h3>
            <p className={`text-xs font-semibold ${isHighRisk ? 'text-red-600' : 'text-slate-500'}`}>
              风险等级：{approval.riskLevel || 'MEDIUM'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {approval.status === 'approved' && <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full"><CheckCircle2 size={14}/> 已批准</span>}
          {approval.status === 'rejected' && <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full"><XCircle size={14}/> 已拒绝</span>}
          {approval.status === 'pending' && <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full"><Clock size={14}/> 待处理</span>}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Blocked Action Section */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">被阻止动作</label>
          <div className="p-4 rounded-lg bg-slate-900 font-mono text-xs text-slate-300 border border-slate-800">
            {approval.blockedAction || '未知动作'}
          </div>
        </div>

        {/* Risk Reason Section */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">风险原因与因素</label>
          <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100 italic">
            "{approval.riskReason || '此动作需要明确授权以确保系统安全和完整性。'}"
          </p>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">申请人</label>
            <p className="text-xs font-bold text-slate-700">{approval.requestedBy}</p>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">时间</label>
            <p className="text-xs text-slate-500 font-mono">{new Date(approval.requestedAt).toLocaleString()}</p>
          </div>
        </div>

        {/* Action Buttons */}
        {isPending && (
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => onReject()}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              拒绝
            </button>
            <button
              onClick={() => onApprove()}
              disabled={loading}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold text-white shadow-lg transition-transform active:scale-[0.98] disabled:opacity-50 ${isHighRisk ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-black'}`}
            >
              {loading ? '处理中...' : '批准执行'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
