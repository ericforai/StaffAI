'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Target, TrendingUp, Award, BrainCircuit } from 'lucide-react';
import { useAgentMemory } from '../../../hooks/useAgentMemory';
import { AgentGrowthTimeline } from '../../../components/AgentGrowthTimeline';

export default function AgentProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const agentId = params.id;
  const { memory, loading, error } = useAgentMemory(agentId);
  const [agent, setAgent] = useState<any>(null);

  useEffect(() => {
    async function loadAgent() {
      try {
        const res = await fetch(`http://localhost:3333/api/agents/${agentId}`);
        if (res.ok) {
          const data = await res.json();
          setAgent(data);
        }
      } catch (err) {
        console.error('Failed to load agent:', err);
      }
    }
    void loadAgent();
  }, [agentId]);

  if (!agent) return <div className="p-20 text-center">Loading Profile...</div>;

  return (
    <main className="min-h-screen bg-[#f8fafc] pb-20">
      {/* Top Navigation */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold text-sm"
          >
            <ArrowLeft size={18} />
            BACK TO FLEET
          </button>
          <div className="flex items-center gap-4">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Agent Dossier</span>
             <div className="h-4 w-px bg-slate-200" />
             <span className="text-xs font-bold text-slate-900">{agent.frontmatter?.name}</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-12">
          
          {/* Main Content: Growth Timeline */}
          <div className="space-y-12">
            <header>
              <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-4">
                <BrainCircuit size={36} className="text-blue-600" />
                Evolution Dashboard
              </h1>
              <p className="mt-4 text-slate-500 max-w-2xl leading-relaxed">
                Tracking the growth, insights, and behavioral refinements of <strong>{agent.frontmatter?.name}</strong>. 
                This agent evolves based on every completed task and user correction.
              </p>
            </header>

            <section>
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                <TrendingUp size={16} />
                Growth Timeline
              </h2>
              <AgentGrowthTimeline memory={memory} loading={loading} />
            </section>
          </div>

          {/* Sidebar: Metrics & Trust */}
          <div className="space-y-8">
            {/* Trust Level Card (Mocked) */}
            <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl shadow-blue-900/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <ShieldCheck size={120} />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-6">Autonomy Trust Level</h3>
              <div className="space-y-4 relative z-10">
                <div className="flex justify-between items-end">
                  <span className="text-3xl font-black italic">EXPERT</span>
                  <span className="text-blue-400 font-mono text-sm">Level 4</span>
                </div>
                {/* Progress Bar */}
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700 p-0.5">
                  <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-400 rounded-full w-[85%]" />
                </div>
                <p className="text-[10px] leading-relaxed text-slate-400 font-bold uppercase tracking-wider">
                  85% progression towards full autonomy (L3). Based on 12 successful complex deliveries.
                </p>
              </div>
            </div>

            {/* Performance Stats */}
            <div className="bg-white rounded-[2rem] border border-slate-200 p-8 space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Core Indicators</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2">
                    <Target size={14} className="text-slate-400" /> Success Rate
                  </span>
                  <span className="text-sm font-black text-slate-900">98.2%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2">
                    <Award size={14} className="text-slate-400" /> Insights Extracted
                  </span>
                  <span className="text-sm font-black text-slate-900">{memory?.experienceLog.length || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2">
                    <ShieldCheck size={14} className="text-slate-400" /> Heuristics
                  </span>
                  <span className="text-sm font-black text-slate-900">{memory?.behavioralHeuristics.length || 0}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
