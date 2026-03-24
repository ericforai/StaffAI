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
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  if (stepIndex < activeIndex || status === 'completed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (stepIndex === activeIndex) {
    return 'border-[#c7d6dd] bg-[#eef4f6] text-slate-800 shadow-[0_10px_24px_rgba(112,143,160,0.12)]';
  }

  return 'border-[#e4dbcf] bg-white text-slate-500';
}

function renderProgressBoard(
  label: string,
  progress: ToolProgressState,
  steps: ProgressStep[]
) {
  if (progress.status === 'idle' && progress.progress === 0) {
    return null;
  }

  const activeIndex = getCurrentStepIndex(steps, progress.stage, progress.status);

  return (
    <div className="mb-4 rounded-[1.4rem] border border-[#e4dbcf] bg-[#f7f3ed] px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black tracking-[0.18em] text-slate-500">{label}</p>
          <p className="mt-1 text-sm font-black text-slate-900">{progress.message}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black tracking-[0.18em] text-slate-500">{progress.status}</p>
          <p className="mt-1 text-lg font-black text-slate-900">{progress.progress}%</p>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[#e7ddd2]">
        <div
          className="h-full rounded-full bg-[#8ca6b4] transition-all duration-500"
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
              <span className="text-[10px] font-black tracking-[0.18em]">
                {index < activeIndex || progress.status === 'completed'
                  ? '完成'
                  : index === activeIndex
                    ? '进行中'
                    : '待开始'}
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
    <section className="flex h-full min-h-0 flex-col rounded-[2rem] border border-[#dfd5c8] bg-[#fffdfa]/94 shadow-[0_14px_44px_rgba(128,110,82,0.08)]">
      <div className="border-b border-[#ebe2d7] px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-[1.1rem] border border-[#e3d9cc] bg-white p-3 shadow-sm">
              <BrainCircuit className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <p className="text-[11px] font-black tracking-[0.22em] text-slate-500">
                讨论控制台
              </p>
              <h3 className="text-xl font-black tracking-tight text-slate-900">组织讨论与沉淀结论</h3>
            </div>
          </div>

          <div className="rounded-full border border-[#e5ddd2] bg-[#fbf7f1] px-3 py-1 text-[11px] font-black text-slate-600">
            已选 {selectedAgentIds.length} 位
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 custom-scrollbar">
        <div className="rounded-[1.6rem] border border-[#ebe2d7] bg-[#fbf8f3] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black tracking-[0.18em] text-slate-500">运行环境</p>
              <h4 className="mt-1 text-base font-black tracking-tight text-slate-900">宿主能力与降级状态</h4>
            </div>
            <div className="rounded-full border border-[#ddd3c7] bg-white px-3 py-1 text-[10px] font-black tracking-[0.18em] text-slate-500">
              {runtimeLoading ? '同步中' : selectedHostId}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[1.3rem] border border-[#ebe2d7] bg-white p-4">
              <p className="text-[10px] font-black tracking-[0.18em] text-slate-500">宿主切换</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {runtimeHosts.map((host) => (
                  <button
                    key={host.id}
                    onClick={() => onSelectHost(host.id as 'claude' | 'codex' | 'gemini')}
                    className={`rounded-full border px-3 py-2 text-[11px] font-black tracking-[0.12em] transition-all ${
                      selectedHostId === host.id
                        ? 'border-[#b8c9d2] bg-[#eef4f6] text-slate-800'
                        : 'border-[#ebe2d7] bg-[#fbf7f1] text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {host.id}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-[#eee4d8] bg-[#fcfaf5] px-4 py-3">
                  <p className="text-[10px] font-black tracking-[0.18em] text-slate-500">能力等级</p>
                  <p className="mt-2 text-sm font-black text-slate-900">{runtimeHost?.capabilityLevel || '未知'}</p>
                  <p className="mt-2 text-xs leading-6 text-slate-600">{runtimeHost?.degradation.manualFallback || '等待运行环境返回状态。'}</p>
                </div>
                <div className="rounded-2xl border border-[#eee4d8] bg-[#fcfaf5] px-4 py-3">
                  <p className="text-[10px] font-black tracking-[0.18em] text-slate-500">状态目录</p>
                  <p className="mt-2 break-all text-sm font-black text-slate-900">{runtimeStateDir}</p>
                  <p className="mt-2 text-xs text-slate-600">
                    采样 {runtimeHost?.supportsSampling ? '开启' : '关闭'} · 注入 {runtimeHost?.supportsInjection ? '原生' : '手动'}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.3rem] border border-[#ebe2d7] bg-white p-4">
              <p className="text-[10px] font-black tracking-[0.18em] text-slate-500">建议动作</p>
              <div className="mt-3 space-y-2">
                {runtimeRecommendations.slice(0, 3).map((item) => (
                  <div key={item.action} className="rounded-2xl border border-[#eee4d8] bg-[#fcfaf5] px-3 py-3">
                    <p className="text-xs font-black tracking-[0.14em] text-slate-800">{item.label}</p>
                    <p className="mt-2 text-xs leading-6 text-slate-600">{item.reason}</p>
                  </div>
                ))}
                {runtimeRecommendations.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-[#e4dbcf] bg-[#faf7f2] px-3 py-3 text-xs text-slate-500">
                    当前还没有推荐动作。
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[1.3rem] border border-[#ebe2d7] bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[10px] font-black tracking-[0.18em] text-slate-500">能力列表</p>
              <span className="text-[10px] font-black tracking-[0.18em] text-slate-500">已加载 {runtimeCapabilities.length} 项</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {runtimeCapabilities.slice(0, 8).map((capability) => (
                <span
                  key={capability.id}
                  className="rounded-full border border-[#ebe2d7] bg-[#fbf7f1] px-3 py-2 text-[11px] font-black text-slate-700"
                >
                  {capability.id}
                </span>
              ))}
            </div>
            {runtimeError && <p className="mt-3 text-xs text-rose-600">{runtimeError}</p>}
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-[#ebe2d7] bg-[#fbf8f3] p-4">
          <div className="mb-3 flex items-center gap-2">
            <WandSparkles className="h-4 w-4 text-[#9b8164]" />
            <p className="text-[11px] font-black tracking-[0.18em] text-slate-500">讨论简报</p>
          </div>

          <textarea
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="描述你希望这场专家讨论解决的问题、目标和限制。"
            className="h-32 w-full resize-none rounded-[1.2rem] border border-[#ddd3c7] bg-white px-4 py-4 text-base leading-7 text-slate-800 outline-none transition-all focus:border-[#b7a894]"
          />

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <div>
              <p className="mb-2 text-[11px] font-black tracking-[0.18em] text-slate-500">参与人数</p>
              <div className="flex gap-2">
                {PARTICIPANT_OPTIONS.map((count) => (
                  <button
                    key={count}
                    onClick={() => setParticipantCount(count)}
                    className={`h-10 w-10 rounded-2xl border text-sm font-black transition-all ${
                      participantCount === count
                        ? 'border-[#b8c9d2] bg-[#eef4f6] text-slate-800'
                        : 'border-[#e5ddd2] bg-white text-slate-500 hover:border-[#cfbfac] hover:text-slate-800'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-black tracking-[0.18em] text-slate-500">执行模式</p>
              <div className="grid gap-2">
                <div className="rounded-xl border border-[#e5ddd2] bg-white px-3 py-2 text-xs font-black tracking-[0.16em] text-slate-700">
                  采样能力：
                  {capabilitiesLoading ? '检测中' : samplingEnabled === null ? '未知' : samplingEnabled ? '可用' : '不可用'}
                </div>
                <div className="rounded-xl border border-[#e5ddd2] bg-white px-3 py-2">
                  <select
                    value={executionMode}
                    onChange={(event) => setExecutionMode(event.target.value as ExecutionMode)}
                    className="w-full bg-transparent text-sm font-black text-slate-800 outline-none"
                  >
                    <option value="auto">自动选择</option>
                    <option value="force_serial">强制串行</option>
                    <option value="require_sampling">必须采样</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <button
                onClick={onSearchExperts}
                disabled={searching}
                className="flex items-center justify-center gap-2 rounded-2xl border border-[#e5ddd2] bg-white px-4 py-3 text-sm font-black text-slate-800 transition-all hover:border-[#cfbfac] hover:bg-[#fbf4ea] disabled:opacity-60"
              >
                {searching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
                搜索专家
              </button>
              <button
                onClick={onRunDiscussion}
                disabled={running}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#8aa4b1] px-4 py-3 text-sm font-black text-white shadow-[0_10px_22px_rgba(138,164,177,0.18)] transition-all hover:opacity-90 disabled:opacity-60"
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

        <div className="rounded-[1.6rem] border border-[#ebe2d7] bg-[#fbf8f3] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black tracking-[0.18em] text-slate-500">常用阵容</p>
              <h4 className="mt-1 text-base font-black tracking-tight text-slate-900">模板与一键复用</h4>
            </div>
            <button
              onClick={onSaveCurrentSelection}
              disabled={selectedAgentIds.length === 0}
              className="inline-flex items-center gap-2 rounded-full border border-[#ddd3c7] bg-white px-3 py-2 text-xs font-black text-slate-800 transition-all hover:border-[#b7a894] hover:bg-[#f7f2ea] disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              保存阵容
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {templates.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#ddd3c7] bg-white px-4 py-3 text-sm text-slate-600">
                还没有讨论模板。先选一组专家，再保存成可复用的小队。
              </div>
            )}

            {templates.map((template) => (
              <button
                key={template.name}
                onClick={() => onApplyTemplate(template)}
                className="inline-flex items-center gap-2 rounded-full border border-[#ddd3c7] bg-white px-3 py-2 text-xs font-black text-slate-700 transition-all hover:border-[#b7a894] hover:text-slate-900"
              >
                <FolderHeart className="h-3.5 w-3.5 text-rose-300" />
                {template.name}
                <span className="text-slate-500">{template.activeAgentIds.length}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-[#ebe2d7] bg-[#fbf8f3] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black tracking-[0.18em] text-slate-500">候选专家</p>
              <h4 className="mt-1 text-base font-black tracking-tight text-slate-900">搜索结果与编组选择</h4>
            </div>

            <div className="rounded-full border border-[#ddd3c7] bg-white px-3 py-1 text-[11px] font-black text-slate-600">
              匹配 {experts.length} 位
            </div>
          </div>

          <div className="space-y-3">
            {experts.length === 0 && (
              <div className="rounded-[1.3rem] border border-dashed border-[#ddd3c7] bg-white px-4 py-5 text-sm leading-7 text-slate-600">
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
                      ? 'border-[#b8c9d2] bg-[#f2f7f8] shadow-[0_10px_24px_rgba(112,143,160,0.12)]'
                      : 'border-[#e5ddd2] bg-white hover:border-[#cfbfac] hover:bg-[#fcfaf5]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black tracking-tight text-slate-900">{expert.name}</p>
                        {expert.isActive && (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">
                            在职
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{expert.description}</p>
                    </div>

                    <div className="text-right">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-[#f1ebe2] px-2.5 py-1 text-[11px] font-black text-slate-700">
                        <Crosshair className="h-3 w-3 text-[#9b8164]" />
                        {expert.score}
                      </div>
                      <p className="mt-2 text-[10px] font-black tracking-[0.18em] text-slate-500">
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
            className="flex items-center justify-center gap-2 rounded-2xl border border-[#e5ddd2] bg-white px-4 py-3 text-sm font-black text-slate-800 transition-all hover:border-[#cfbfac] hover:bg-[#fbf4ea] disabled:opacity-50"
            >
              {hiring ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              雇佣已选
            </button>

            <div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#ddd3c7] bg-[#f7f3ed] px-4 py-3 text-sm font-black text-slate-700">
              <Users className="h-4 w-4 text-[#9b8164]" />
              当前阵容 {selectedAgentIds.length} 位
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <p>{error}</p>
            {structuredError?.reason && (
              <div className="mt-2 space-y-1 text-xs leading-relaxed text-rose-700">
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
                    className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-left text-xs font-black text-rose-700 transition-all hover:border-rose-300"
                  >
                    <p>{action.label}</p>
                    <p className="mt-1 text-[11px] font-normal text-rose-600">{action.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-[1.6rem] border border-[#ebe2d7] bg-[#fbf8f3] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black tracking-[0.18em] text-slate-500">快捷顾问</p>
              <h4 className="mt-1 text-base font-black tracking-tight text-slate-900">快速顾问咨询</h4>
            </div>
            {consultResult?.executor && (
              <div className="rounded-full border border-[#ddd3c7] bg-white px-3 py-1 text-[10px] font-black tracking-[0.18em] text-slate-600">
                通过 {consultResult.executor}
              </div>
            )}
          </div>

          {renderProgressBoard('顾问流程', consultProgress, CONSULT_STEPS)}

          <button
            onClick={onConsultAgency}
            disabled={consulting || !topic.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#e5ddd2] bg-white px-4 py-3 text-sm font-black text-slate-800 transition-all hover:border-[#cfbfac] hover:bg-[#fbf4ea] disabled:opacity-50"
          >
            {consulting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            调用顾问
          </button>

          <div className="mt-4 rounded-2xl border border-[#e4dbcf] bg-white px-4 py-4">
            {!consultResult ? (
              <p className="text-sm leading-7 text-slate-600">
                这里会基于当前主题快速选择一位最合适的顾问，直接返回可执行建议。
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-900">{consultResult.agentName || '最佳顾问'}</p>
                  {consultResult.agentId && (
                    <span className="text-[10px] font-black tracking-[0.18em] text-slate-500">
                      {consultResult.agentId}
                    </span>
                  )}
                </div>
                <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {consultResult.text}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-[#ebe2d7] bg-[#fbf8f3] p-4">
          <div className="mb-4">
            <p className="text-[11px] font-black tracking-[0.18em] text-slate-500">结果记录</p>
            <h4 className="mt-1 text-base font-black tracking-tight text-slate-900">写入知识库</h4>
          </div>

          <div className="space-y-3">
            <input
              value={reportTask}
              onChange={(event) => setReportTask(event.target.value)}
              placeholder="任务名称"
              className="w-full rounded-2xl border border-[#ddd3c7] bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-[#b7a894]"
            />

            <div className="rounded-2xl border border-[#ddd3c7] bg-white px-3 py-2">
              <select
                value={reportAgentId}
                onChange={(event) => setReportAgentId(event.target.value)}
                className="w-full bg-transparent text-sm text-slate-800 outline-none"
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
              className="h-28 w-full resize-none rounded-2xl border border-[#ddd3c7] bg-white px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition-all focus:border-[#b7a894]"
            />

            <button
              onClick={onReportTaskResult}
              disabled={reporting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#e5ddd2] bg-white px-4 py-3 text-sm font-black text-slate-800 transition-all hover:border-[#cfbfac] hover:bg-[#fbf4ea] disabled:opacity-50"
            >
              {reporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              写入知识库
            </button>

            {reportResult?.message && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {reportResult.message}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-[#ebe2d7] bg-[#fbf8f3] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black tracking-[0.18em] text-slate-500">讨论结果</p>
              <h4 className="mt-1 text-base font-black tracking-tight text-slate-900">专家执行与综合结论</h4>
            </div>
            <div className="flex items-center gap-3">
              {result?.degraded && (
                <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black text-amber-700">
                  已降级执行
                </div>
              )}
              {result?.executor && (
                <div className="rounded-full border border-[#ddd3c7] bg-white px-3 py-1 text-[10px] font-black text-slate-600">
                  通过 {result.executor}
                </div>
              )}
              <Sparkles className="h-4 w-4 text-[#9b8164]" />
            </div>
          </div>

          {renderProgressBoard('讨论流程', discussionProgress, DISCUSSION_STEPS)}

          {result?.notice && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700">
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
                  <div key={title} className="rounded-2xl border border-[#e4dbcf] bg-white px-4 py-4">
                    <p className="text-sm font-black text-slate-900">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-[#e4dbcf] bg-white px-4 py-4">
                <p className="text-xs font-black tracking-[0.18em] text-slate-500">当前已选专家</p>
                <div className="mt-3 space-y-2">
                  {selectedAgentIds.length === 0 && (
                    <p className="text-sm text-slate-600">还没有编组专家。先搜索或套用模板。</p>
                  )}

                  {experts
                    .filter((expert) => selectedAgentIds.includes(expert.id))
                    .map((expert) => (
                      <div key={expert.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f3ed] px-3 py-3">
                        <div>
                          <p className="text-sm font-black text-slate-900">{expert.name}</p>
                          <p className="mt-1 text-xs text-slate-600">{expert.description}</p>
                        </div>
                        {expert.isActive && (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">
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
              <div className="rounded-[1.35rem] border border-[#d8e3e8] bg-[#eef4f6] px-4 py-4">
                <p className="text-xs font-black tracking-[0.18em] text-slate-600">综合结论</p>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-800">
                  {result.synthesis}
                </div>
              </div>

              {result.participants.map((participant) => (
                <div key={participant.id} className="rounded-[1.35rem] border border-[#e4dbcf] bg-white px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-[#9b8164]" />
                      <p className="text-sm font-black text-slate-900">{participant.name}</p>
                    </div>
                    <span className="text-[10px] font-black tracking-[0.18em] text-slate-500">
                      {participant.hiredForTask ? '新入职' : '原在职'}
                    </span>
                  </div>

                  <p className="mt-3 text-xs leading-6 text-slate-600">{participant.assignment}</p>

                  <div className="mt-4 rounded-2xl border border-[#e4dbcf] bg-[#f7f3ed] px-4 py-4">
                    <div className="mb-3 flex items-center gap-2 text-[11px] font-black tracking-[0.18em] text-slate-600">
                      <ChevronRight className="h-3 w-3" />
                      独立回复
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
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
