'use client';

import { useState, useEffect } from 'react';
import { Target, Plus, ChevronRight, BarChart2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { OKRRecord, KeyResult } from '../../types/domain';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api';

export function OKRManager() {
  const [okrs, setOkrs] = useState<OKRRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOkrs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/okrs`);
      if (res.ok) {
        const data = await res.json();
        setOkrs(data);
      }
    } catch (err) {
      console.error('Failed to fetch OKRs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOkrs();
  }, []);

  const calculateProgress = (kr: KeyResult) => {
    if (kr.targetValue === 0) return 0;
    return Math.min(Math.round((kr.currentValueValue / kr.targetValue) * 100), 100);
  };

  if (loading) return <div className="p-12 text-center text-slate-400">正在同步战略指标...</div>;

  return (
    <div className="space-y-8">
      {/* OKR List */}
      <div className="grid gap-6">
        {okrs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-white">
            <div className="p-4 bg-slate-50 rounded-full mb-4">
              <Target size={40} className="text-slate-300" />
            </div>
            <p className="text-lg font-black text-slate-400 uppercase tracking-widest">战略目标空缺</p>
            <p className="text-sm text-slate-500 mt-2">点击上方按钮录入您的第一个业务 OKR。</p>
          </div>
        ) : (
          okrs.map((okr) => (
            <div key={okr.id} className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-600 rounded-2xl text-white">
                    <Target size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 leading-tight">{okr.objective}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Strategic Objective</p>
                  </div>
                </div>
                <div className="px-4 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest border border-blue-100">
                  {okr.status}
                </div>
              </div>

              <div className="space-y-6">
                {okr.keyResults.map((kr) => {
                  const progress = calculateProgress(kr);
                  return (
                    <div key={kr.id} className="space-y-3">
                      <div className="flex justify-between items-end text-sm">
                        <span className="font-bold text-slate-700">{kr.description}</span>
                        <span className="font-mono text-slate-500 text-xs">{kr.currentValueValue} / {kr.targetValue} {kr.unit}</span>
                      </div>
                      <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`absolute inset-y-0 left-0 transition-all duration-1000 ${progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                          style={{ width: `${progress}%` }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <OKRCreateModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchOkrs} 
      />
    </div>
  );
}
e={{ width: `${progress}%` }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
