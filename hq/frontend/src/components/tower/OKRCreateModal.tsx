'use client';

import { useState } from 'react';
import { X, Plus, Trash2, Save } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api';

export function OKRCreateModal({ isOpen, onClose, onSuccess }: Props) {
  const [objective, setObjective] = useState('');
  const [keyResults, setKeyResults] = useState([
    { description: '', targetValue: 100, unit: '%', metricKey: 'custom' }
  ]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const addKR = () => {
    setKeyResults([...keyResults, { description: '', targetValue: 100, unit: '%', metricKey: 'custom' }]);
  };

  const removeKR = (index: number) => {
    setKeyResults(keyResults.filter((_, i) => i !== index));
  };

  const updateKR = (index: number, fields: any) => {
    const newKRs = [...keyResults];
    newKRs[index] = { ...newKRs[index], ...fields };
    setKeyResults(newKRs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/okrs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective, keyResults }),
      });
      if (res.ok) {
        onSuccess();
        onClose();
      }
    } catch (err) {
      console.error('Failed to create OKR:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">发布战略 OKR</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">New Strategic Objective</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {/* Objective */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Objective (目标)</label>
            <input
              required
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="例如：提升核心模块代码质量"
              className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-900"
            />
          </div>

          {/* Key Results */}
          <div className="space-y-6">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Key Results (关键结果)</label>
              <button type="button" onClick={addKR} className="text-blue-600 hover:text-blue-700 font-black text-[10px] uppercase flex items-center gap-1 transition-colors">
                <Plus size={14} /> 增加 KR
              </button>
            </div>

            <div className="space-y-4">
              {keyResults.map((kr, index) => (
                <div key={index} className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-4 relative group">
                  {keyResults.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeKR(index)}
                      className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  
                  <div className="grid gap-4">
                    <input
                      required
                      placeholder="KR 描述（如：单元测试覆盖率）"
                      value={kr.description}
                      onChange={(e) => updateKR(index, { description: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm font-bold"
                    />
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Target</span>
                        <input
                          type="number"
                          value={kr.targetValue}
                          onChange={(e) => updateKR(index, { targetValue: Number(e.target.value) })}
                          className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Unit</span>
                        <input
                          placeholder="%"
                          value={kr.unit}
                          onChange={(e) => updateKR(index, { unit: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Metric</span>
                        <select
                          value={kr.metricKey}
                          onChange={(e) => updateKR(index, { metricKey: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm"
                        >
                          <option value="test_coverage">Test Coverage</option>
                          <option value="success_rate">Success Rate</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        <div className="p-8 bg-slate-50/80 border-t border-slate-100 flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-4 rounded-2xl border border-slate-200 font-bold text-slate-600 hover:bg-white transition-all"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !objective}
            className="flex-2 px-10 py-4 rounded-2xl bg-slate-900 text-white font-black shadow-lg shadow-slate-200 hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? '正在发布...' : <><Save size={18} /> 发布并激活 OKR</>}
          </button>
        </div>
      </div>
    </div>
  );
}
