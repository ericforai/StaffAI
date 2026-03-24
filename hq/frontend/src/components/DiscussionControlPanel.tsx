import { motion } from 'framer-motion';
import {
  Bot,
  BrainCircuit,
  ChevronRight,
  Crosshair,
  FileSearch,
  FolderHeart,
  LoaderCircle,
  Play,
  Save,
  Sparkles,
  UserPlus,
  Users,
  WandSparkles,
} from 'lucide-react';
import { DiscussionExpert, DiscussionRunResult } from '../hooks/useDiscussionControl';
import { SaveTemplateModal } from './SaveTemplateModal';
import { RuntimeCapability, RuntimeHostSummary, RuntimeRecommendation } from '../hooks/useRuntimeFoundation';

interface DiscussionTemplate {
  name: string;
  activeAgentIds: string[];
}

type ExecutionMode = 'auto' | 'force_serial' | 'require_sampling';

interface StructuredAction {
  key: 'switch_client' | 'auto_downgrade' | 'single_expert';
  label: string;
  description: string;
}

interface ConsultResult {
  task: string;
  text: string;
  executor?: string;
  agentId?: string;
  agentName?: string;
}

interface ReportResult {
  success?: boolean;
  message?: string;
}

interface ToolProgressState {
  stage: string;
  message: string;
  progress: number;
  status: 'idle' | 'started' | 'running' | 'completed' | 'failed';
  executor?: 'claude' | 'codex' | 'openai';
}

interface ProgressStep {
  key: string;
  title: string;
  description: string;
}

interface DiscussionControlPanelProps {
  topic: string;
  setTopic: (value: string) => void;
  participantCount: number;
  setParticipantCount: (value: number) => void;
  experts: DiscussionExpert[];
  selectedAgentIds: string[];
  result: DiscussionRunResult | null;
  templates: DiscussionTemplate[];
  error: string | null;
  searching: boolean;
  hiring: boolean;
  running: boolean;
  showSaveTemplateInput: boolean;
  saveTemplateName: string;
  onChangeSaveTemplateName: (value: string) => void;
  onConfirmSaveTemplate: () => void;
  onCancelSaveTemplate: () => void;
  onToggleSelection: (agentId: string) => void;
  onSearchExperts: () => void;
  onHireSelected: () => void;
  onRunDiscussion: () => void;
  onApplyTemplate: (template: DiscussionTemplate) => void;
  onSaveCurrentSelection: () => void;
  consultResult: ConsultResult | null;
  consulting: boolean;
  onConsultAgency: () => void;
  reportTask: string;
  setReportTask: (value: string) => void;
  reportAgentId: string;
  setReportAgentId: (value: string) => void;
  reportSummary: string;
  setReportSummary: (value: string) => void;
  reportResult: ReportResult | null;
  reporting: boolean;
  reportAgentOptions: Array<{ id: string; name: string }>;
  onReportTaskResult: () => void;
  consultProgress: ToolProgressState;
  discussionProgress: ToolProgressState;
  samplingEnabled: boolean | null;
  capabilitiesLoading: boolean;
  executionMode: ExecutionMode;
  setExecutionMode: (mode: ExecutionMode) => void;
  structuredError?: {
    reason?: string;
    impact?: string;
    actions?: StructuredAction[];
  } | null;
  onStructuredAction: (key: StructuredAction['key']) => void;
  runtimeHost: RuntimeHostSummary | null;
  runtimeHosts: RuntimeHostSummary[];
  runtimeCapabilities: RuntimeCapability[];
  runtimeRecommendations: RuntimeRecommendation[];
  runtimeStateDir: string;
  runtimeLoading: boolean;
  runtimeError: string | null;
  selectedHostId: 'claude' | 'codex' | 'gemini';
  onSelectHost: (hostId: 'claude' | 'codex' | 'gemini') => void;
}

const PARTICIPANT_OPTIONS = [2, 3, 4];

const DISCUSSION_STEPS: ProgressStep[] = [
  { key: 'preparing-squad', title: '准备', description: '整理阵容与讨论目标' },
  { key: 'hiring-experts', title: '雇佣', description: '补齐未在职但关键的专家' },
  { key: 'collecting-replies', title: '执行', description: '逐位专家生成独立回复' },
  { key: 'synthesizing', title: '综合', description: '主持人生成统一结论' },
];

const CONSULT_STEPS: ProgressStep[] = [
  { key: 'matching-expert', title: '匹配', description: '寻找最合适的顾问' },
  { key: 'hiring-expert', title: '入职', description: '必要时自动补齐顾问' },
  { key: 'executing-expert', title: '执行', description: '顾问生成专业建议' },
  { key: 'completed', title: '完成', description: '建议已返回到控制台' },
];

function getCurrentStepIndex(steps: ProgressStep[], stage: string, status: ToolProgressState['status']) {
  if (status === 'completed') {
    return steps.length - 1;
  }

  const index = steps.findIndex((step) => step.key === stage);
  return index >= 0 ? index : -1;
}

function getStepTone(stepIndex: number, activeIndex: number, status: ToolProgressState['status']) {
  if (status === 'failed') {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-100';
  }

  if (stepIndex < activeIndex || status === 'completed') {
    return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100';
  }

  if (stepIndex === activeIndex) {
    return 'border-cyan-400/40 bg-cyan-400/12 text-cyan-50 shadow-[0_12px_30px_rgba(34,211,238,0.12)]';
  }

  return 'border-white/10 bg-white/[0.03] text-slate-500';
}

function renderProgressBoard(
  label: string,
  progress: ToolProgressState,
  steps: ProgressStep[]
) {
  const activeIndex = getCurrentStepIndex(steps, progress.stage, progress.status);

  return (
    <div className="mb-4 rounded-[1.7rem] border border-white/10 bg-[#0d1118] px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</p>
          <p className="mt-1 text-sm font-black text-white">{progress.message}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">{progress.status}</p>
          <p className="mt-1 text-lg font-black text-white">{progress.progress}%</p>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 transition-all duration-500"
          style={{ width: `${progress.progress}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {steps.map((step, index) => (
          <div
            key={step.key}
            className={`rounded-[1.25rem] border px-4 py-4 transition-all ${getStepTone(index, activeIndex, progress.status)}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black">{step.title}</p>
              <span className="text-[10px] font-black uppercase tracking-[0.22em]">
                {index < activeIndex || progress.status === 'completed'
                  ? 'done'
                  : index === activeIndex
                    ? 'live'
                    : 'wait'}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed opacity-80">{step.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DiscussionControlPanel({
  topic,
  setTopic,
  participantCount,
  setParticipantCount,
  experts,
  selectedAgentIds,
  result,
  templates,
  error,
  searching,
  hiring,
  running,
  showSaveTemplateInput,
  saveTemplateName,
  onChangeSaveTemplateName,
  onConfirmSaveTemplate,
  onCancelSaveTemplate,
  onToggleSelection,
  onSearchExperts,
  onHireSelected,
  onRunDiscussion,
  onApplyTemplate,
  onSaveCurrentSelection,
  consultResult,
  consulting,
  onConsultAgency,
  reportTask,
  setReportTask,
  reportAgentId,
  setReportAgentId,
  reportSummary,
  setReportSummary,
  reportResult,
  reporting,
  reportAgentOptions,
  onReportTaskResult,
  consultProgress,
  discussionProgress,
  samplingEnabled,
  capabilitiesLoading,
  executionMode,
  setExecutionMode,
  structuredError,
  onStructuredAction,
  runtimeHost,
  runtimeHosts,
  runtimeCapabilities,
  runtimeRecommendations,
  runtimeStateDir,
  runtimeLoading,
  runtimeError,
  selectedHostId,
  onSelectHost,
}: DiscussionControlPanelProps) {
  return (
    <section className="flex h-full min-h-0 flex-col rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(14,18,28,0.98),rgba(9,12,20,0.96))] shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3">
              <BrainCircuit className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300/70">
                Mission Control
              </p>
              <h3 className="text-xl font-black tracking-tight text-white">真实多代理讨论控制台</h3>
            </div>
          </div>

          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
            {selectedAgentIds.length} selected
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5 custom-scrollbar">
        <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Runtime Foundation</p>
              <h4 className="mt-1 text-base font-black tracking-tight text-white">宿主适配、能力与降级状态</h4>
            </div>
            <div className="rounded-full border border-white/10 bg-[#0d1118] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
              {runtimeLoading ? 'syncing' : selectedHostId}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[1.3rem] border border-white/10 bg-[#0d1118] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Host Router</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {runtimeHosts.map((host) => (
                  <button
                    key={host.id}
                    onClick={() => onSelectHost(host.id as 'claude' | 'codex' | 'gemini')}
                    className={`rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] transition-all ${
                      selectedHostId === host.id
                        ? 'border-cyan-400/50 bg-cyan-400/12 text-cyan-100'
                        : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white'
                    }`}
                  >
                    {host.id}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Capability</p>
                  <p className="mt-2 text-sm font-black text-white">{runtimeHost?.capabilityLevel || 'unknown'}</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">{runtimeHost?.degradation.manualFallback || 'Waiting for runtime data.'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">State Dir</p>
                  <p className="mt-2 break-all text-sm font-black text-white">{runtimeStateDir}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    sampling {runtimeHost?.supportsSampling ? 'on' : 'off'} · injection {runtimeHost?.supportsInjection ? 'native' : 'manual'}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.3rem] border border-white/10 bg-[#0d1118] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Recommended Next</p>
              <div className="mt-3 space-y-2">
                {runtimeRecommendations.slice(0, 3).map((item) => (
                  <div key={item.action} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">{item.label}</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.reason}</p>
                  </div>
                ))}
                {runtimeRecommendations.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-3 py-3 text-xs text-slate-500">
                    当前还没有推荐动作。
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[1.3rem] border border-white/10 bg-[#0d1118] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Runtime Capabilities</p>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{runtimeCapabilities.length} loaded</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {runtimeCapabilities.slice(0, 8).map((capability) => (
                <span
                  key={capability.id}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-black text-slate-300"
                >
                  {capability.id}
                </span>
              ))}
            </div>
            {runtimeError && <p className="mt-3 text-xs text-rose-200">{runtimeError}</p>}
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-3 flex items-center gap-2">
            <WandSparkles className="h-4 w-4 text-cyan-300" />
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Discussion Brief</p>
          </div>

          <textarea
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="描述你希望这场专家讨论解决的问题、目标和限制。"
            className="h-36 w-full resize-none rounded-[1.4rem] border border-white/10 bg-[#0d1118] px-4 py-4 text-sm leading-relaxed text-slate-100 outline-none transition-all focus:border-cyan-400/40 focus:bg-[#0f1724]"
          />

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <div>
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Participants</p>
              <div className="flex gap-2">
                {PARTICIPANT_OPTIONS.map((count) => (
                  <button
                    key={count}
                    onClick={() => setParticipantCount(count)}
                    className={`h-10 w-10 rounded-2xl border text-sm font-black transition-all ${
                      participantCount === count
                        ? 'border-cyan-400/60 bg-cyan-400/15 text-cyan-100'
                        : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Session Capability</p>
              <div className="grid gap-2">
                <div className="rounded-xl border border-white/10 bg-[#0d1118] px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-300">
                  sampling:{' '}
                  {capabilitiesLoading ? 'checking' : samplingEnabled === null ? 'unknown' : samplingEnabled ? 'on' : 'off'}
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0d1118] px-3 py-2">
                  <select
                    value={executionMode}
                    onChange={(event) => setExecutionMode(event.target.value as ExecutionMode)}
                    className="w-full bg-transparent text-xs font-black uppercase tracking-[0.2em] text-slate-200 outline-none"
                  >
                    <option value="auto">auto</option>
                    <option value="force_serial">force_serial</option>
                    <option value="require_sampling">require_sampling</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <button
                onClick={onSearchExperts}
                disabled={searching}
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition-all hover:border-cyan-400/40 hover:bg-cyan-400/10 disabled:opacity-60"
              >
                {searching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
                搜索专家
              </button>
              <button
                onClick={onRunDiscussion}
                disabled={running}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 to-blue-500 px-4 py-3 text-sm font-black text-slate-950 transition-all hover:scale-[1.01] disabled:opacity-60"
              >
                {running ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                运行讨论
              </button>
            </div>
          </div>
        </div>

        <SaveTemplateModal
          show={showSaveTemplateInput}
          value={saveTemplateName}
          onChange={onChangeSaveTemplateName}
          onSave={onConfirmSaveTemplate}
          onCancel={onCancelSaveTemplate}
        />

        <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Reusable Squads</p>
              <h4 className="mt-1 text-base font-black tracking-tight text-white">模板与一键复用</h4>
            </div>
            <button
              onClick={onSaveCurrentSelection}
              disabled={selectedAgentIds.length === 0}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-white transition-all hover:border-fuchsia-400/40 hover:bg-fuchsia-400/10 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              保存阵容
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {templates.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d1118] px-4 py-3 text-sm text-slate-500">
                还没有讨论模板。先选一组专家，再保存成可复用的小队。
              </div>
            )}

            {templates.map((template) => (
              <button
                key={template.name}
                onClick={() => onApplyTemplate(template)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0d1118] px-3 py-2 text-xs font-black text-slate-300 transition-all hover:border-cyan-400/40 hover:text-white"
              >
                <FolderHeart className="h-3.5 w-3.5 text-rose-300" />
                {template.name}
                <span className="text-slate-500">{template.activeAgentIds.length}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Expert Pool</p>
              <h4 className="mt-1 text-base font-black tracking-tight text-white">搜索结果与编组选择</h4>
            </div>

            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
              {experts.length} matches
            </div>
          </div>

          <div className="space-y-3">
            {experts.length === 0 && (
              <div className="rounded-[1.3rem] border border-dashed border-white/10 bg-[#0d1118] px-4 py-5 text-sm leading-relaxed text-slate-500">
                搜索后会在这里看到匹配专家。模板载入的专家也会自动出现在这里，方便你立即复用。
              </div>
            )}

            {experts.map((expert) => {
              const selected = selectedAgentIds.includes(expert.id);

              return (
                <motion.button
                  whileHover={{ y: -2 }}
                  key={expert.id}
                  onClick={() => onToggleSelection(expert.id)}
                  className={`w-full rounded-[1.35rem] border px-4 py-4 text-left transition-all ${
                    selected
                      ? 'border-cyan-400/50 bg-cyan-400/10 shadow-[0_12px_30px_rgba(34,211,238,0.08)]'
                      : 'border-white/10 bg-[#0d1118] hover:border-white/20 hover:bg-[#101725]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black tracking-tight text-white">{expert.name}</p>
                        {expert.isActive && (
                          <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">
                            在职
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-400">{expert.description}</p>
                    </div>

                    <div className="text-right">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-black text-slate-300">
                        <Crosshair className="h-3 w-3 text-cyan-300" />
                        {expert.score}
                      </div>
                      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">
                        {expert.department}
                      </p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={onHireSelected}
              disabled={hiring || selectedAgentIds.length === 0}
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition-all hover:border-emerald-400/40 hover:bg-emerald-400/10 disabled:opacity-50"
            >
              {hiring ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              雇佣已选
            </button>

            <div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#0d1118] px-4 py-3 text-sm font-black text-slate-300">
              <Users className="h-4 w-4 text-cyan-300" />
              当前阵容 {selectedAgentIds.length}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-[1.4rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            <p>{error}</p>
            {structuredError?.reason && (
              <div className="mt-2 space-y-1 text-xs leading-relaxed text-rose-100/90">
                <p>原因：{structuredError.reason}</p>
                {structuredError.impact && <p>影响：{structuredError.impact}</p>}
              </div>
            )}
            {structuredError?.actions && structuredError.actions.length > 0 && (
              <div className="mt-3 grid gap-2">
                {structuredError.actions.map((action) => (
                  <button
                    key={action.key}
                    onClick={() => onStructuredAction(action.key)}
                    className="rounded-xl border border-rose-200/20 bg-rose-950/30 px-3 py-2 text-left text-xs font-black text-rose-100 transition-all hover:border-rose-200/40"
                  >
                    <p>{action.label}</p>
                    <p className="mt-1 text-[11px] font-normal text-rose-100/80">{action.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">MCP Tool</p>
              <h4 className="mt-1 text-base font-black tracking-tight text-white">快速顾问 consult_the_agency</h4>
            </div>
            {consultResult?.executor && (
              <div className="rounded-full border border-white/10 bg-[#0d1118] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
                via {consultResult.executor}
              </div>
            )}
          </div>

          {renderProgressBoard('Advisor Flow', consultProgress, CONSULT_STEPS)}

          <button
            onClick={onConsultAgency}
            disabled={consulting || !topic.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition-all hover:border-cyan-400/40 hover:bg-cyan-400/10 disabled:opacity-50"
          >
            {consulting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            调用顾问
          </button>

          <div className="mt-4 rounded-2xl border border-white/10 bg-[#0d1118] px-4 py-4">
            {!consultResult ? (
              <p className="text-sm leading-relaxed text-slate-500">
                这个按钮会直接映射到 MCP 的 `consult_the_agency`，基于当前主题快速给出一位最佳顾问的真实建议。
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-white">{consultResult.agentName || '最佳顾问'}</p>
                  {consultResult.agentId && (
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                      {consultResult.agentId}
                    </span>
                  )}
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                  {consultResult.text}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">MCP Tool</p>
            <h4 className="mt-1 text-base font-black tracking-tight text-white">记录结果 report_task_result</h4>
          </div>

          <div className="space-y-3">
            <input
              value={reportTask}
              onChange={(event) => setReportTask(event.target.value)}
              placeholder="任务名称"
              className="w-full rounded-2xl border border-white/10 bg-[#0d1118] px-4 py-3 text-sm text-slate-100 outline-none transition-all focus:border-cyan-400/40"
            />

            <div className="rounded-2xl border border-white/10 bg-[#0d1118] px-3 py-2">
              <select
                value={reportAgentId}
                onChange={(event) => setReportAgentId(event.target.value)}
                className="w-full bg-transparent text-sm text-slate-100 outline-none"
              >
                <option value="">选择专家</option>
                {reportAgentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} ({option.id})
                  </option>
                ))}
              </select>
            </div>

            <textarea
              value={reportSummary}
              onChange={(event) => setReportSummary(event.target.value)}
              placeholder="结果摘要"
              className="h-28 w-full resize-none rounded-2xl border border-white/10 bg-[#0d1118] px-4 py-3 text-sm leading-relaxed text-slate-100 outline-none transition-all focus:border-cyan-400/40"
            />

            <button
              onClick={onReportTaskResult}
              disabled={reporting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition-all hover:border-emerald-400/40 hover:bg-emerald-400/10 disabled:opacity-50"
            >
              {reporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              写入知识库
            </button>

            {reportResult?.message && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {reportResult.message}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Execution Output</p>
              <h4 className="mt-1 text-base font-black tracking-tight text-white">专家执行与综合结论</h4>
            </div>
            <div className="flex items-center gap-3">
              {result?.degraded && (
                <div className="rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-100">
                  已降级执行
                </div>
              )}
              {result?.executor && (
                <div className="rounded-full border border-white/10 bg-[#0d1118] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
                  via {result.executor}
                </div>
              )}
              <Sparkles className="h-4 w-4 text-cyan-300" />
            </div>
          </div>

          {renderProgressBoard('Discussion Flow', discussionProgress, DISCUSSION_STEPS)}

          {result?.notice && (
            <div className="mb-4 rounded-xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-100">
              {result.notice}
            </div>
          )}

          {!result ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['搜索', '先按主题挑出最相关专家'],
                  ['雇佣', '让关键角色成为当前阵容'],
                  ['分配', '每位专家都收到独立任务'],
                  ['综合', '汇总为统一行动方案'],
                ].map(([title, description]) => (
                  <div key={title} className="rounded-2xl bg-[#0d1118] px-4 py-4">
                    <p className="text-sm font-black text-white">{title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0d1118] px-4 py-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">当前已选专家</p>
                <div className="mt-3 space-y-2">
                  {selectedAgentIds.length === 0 && (
                    <p className="text-sm text-slate-500">还没有编组专家。先搜索或套用模板。</p>
                  )}

                  {experts
                    .filter((expert) => selectedAgentIds.includes(expert.id))
                    .map((expert) => (
                      <div key={expert.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-3">
                        <div>
                          <p className="text-sm font-black text-white">{expert.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{expert.description}</p>
                        </div>
                        {expert.isActive && (
                          <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">
                            在职
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[1.35rem] border border-cyan-400/20 bg-cyan-400/[0.07] px-4 py-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200/80">综合结论</p>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-100">
                  {result.synthesis}
                </div>
              </div>

              {result.participants.map((participant) => (
                <div key={participant.id} className="rounded-[1.35rem] border border-white/10 bg-[#0d1118] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-cyan-300" />
                      <p className="text-sm font-black text-white">{participant.name}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                      {participant.hiredForTask ? '新入职' : '原在职'}
                    </span>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-slate-500">{participant.assignment}</p>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                    <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">
                      <ChevronRight className="h-3 w-3" />
                      独立回复
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                      {participant.response}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
