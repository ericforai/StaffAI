import type { Application, Request, Response } from 'express';
import { z } from 'zod';
import type { Store } from '../store';
import { 
  RequirementDraft, 
  DesignSummary, 
  IntentStatus, 
  isValidTransition 
} from '../shared/intent-types';
import { BrainstormingService } from '../orchestration/brainstorming-service';
import { PlanGenerationService } from '../orchestration/plan-generation-service';
import { TaskRecord, WorkflowPlan, TaskAssignment, TaskAssignmentRole } from '../shared/task-types';

// Validation schemas
const createIntentSchema = z.object({
  rawInput: z.string().min(1).max(2000),
});

const clarifySchema = z.object({
  message: z.string().min(1).max(5000),
});

const confirmDesignSchema = z.object({
  modifications: z.object({
    goal: z.string().optional(),
    targetUser: z.string().optional(),
    coreFlow: z.string().optional(),
    scope: z.string().optional(),
    outOfScope: z.string().optional(),
    deliverables: z.string().optional(),
    constraints: z.string().optional(),
    risks: z.string().optional(),
  }).optional(),
});

export function registerIntentRoutes(app: Application, store: Store) {
  const brainstormingService = new BrainstormingService();
  const planGenerationService = new PlanGenerationService();

  // POST /api/intents - Create new draft
  app.post('/api/intents', async (req: Request, res: Response) => {
    try {
      const { rawInput } = createIntentSchema.parse(req.body);
      const now = new Date().toISOString();
      const draftId = `intent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const draft: RequirementDraft = {
        id: draftId,
        rawInput,
        status: 'intake',
        clarificationMessages: [],
        designSummary: null,
        implementationPlan: null,
        suggestedAutonomyLevel: null,
        suggestedScenario: null,
        confidenceScore: 0,
        createdTaskId: null,
        createdAt: now,
        updatedAt: now,
      };

      // Save draft first, then get LLM to generate opening question
      await store.saveRequirementDraft(draft);

      // Generate opening question from Workshop LLM
      try {
        const streamingClient = brainstormingService.getStreamingClient();
        let firstQuestion = '';

        for await (const event of streamingClient.streamClarification(draft, rawInput)) {
          if (event.content) {
            firstQuestion += event.content;
          }
          if (event.done) break;
        }

        // Update draft with LLM's first question
        draft.clarificationMessages.push({
          id: `msg_${Date.now()}_a`,
          role: 'assistant',
          content: firstQuestion.trim() || '你好！请详细描述你想要构建的功能。',
          timestamp: new Date().toISOString(),
        });
        draft.confidenceScore = 0.4;
        await store.saveRequirementDraft(draft);
      } catch (err) {
        // Fallback question if Workshop fails
        draft.clarificationMessages.push({
          id: `msg_${Date.now()}_a`,
          role: 'assistant',
          content: '你好！请详细描述你想要构建的功能。',
          timestamp: new Date().toISOString(),
        });
        await store.saveRequirementDraft(draft);
      }

      res.status(201).json(draft);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  // GET /api/intents - List drafts
  app.get('/api/intents', async (req: Request, res: Response) => {
    const drafts = await store.getRequirementDrafts();
    res.json(drafts);
  });

  // GET /api/intents/:id - Get single draft
  app.get('/api/intents/:id', async (req: Request, res: Response) => {
    const draft = await store.getRequirementDraftById(req.params.id as string);
    if (!draft) return res.status(404).json({ error: 'Intent not found' });
    res.json(draft);
  });

  // POST /api/intents/:id/clarify - Continue dialogue
  app.post('/api/intents/:id/clarify', async (req: Request, res: Response) => {
    try {
      const { message } = clarifySchema.parse(req.body);
      const draft = await store.getRequirementDraftById(req.params.id as string);
      if (!draft) return res.status(404).json({ error: 'Intent not found' });

      const result = await brainstormingService.clarify(draft, message);
      await store.saveRequirementDraft(result.updatedDraft);

      res.json({
        draft: result.updatedDraft,
        isComplete: result.isComplete,
      });
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  // POST /api/intents/:id/clarify/stream - SSE streaming for real-time dialogue
  app.post('/api/intents/:id/clarify/stream', async (req: Request, res: Response) => {
    try {
      const { message } = clarifySchema.parse(req.body);
      const draft = await store.getRequirementDraftById(req.params.id as string);
      if (!draft) {
        res.status(404).json({ error: 'Intent not found' });
        return;
      }

      // Record user message
      const now = new Date().toISOString();
      const userMsgId = `msg_${Date.now()}_u`;
      draft.clarificationMessages.push({
        id: userMsgId,
        role: 'user',
        content: message,
        timestamp: now,
      });
      draft.status = 'clarifying';
      draft.updatedAt = now;
      await store.saveRequirementDraft(draft);

      // Send user message acknowledgment
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      // Send user message event
      res.write(`data: ${JSON.stringify({ type: 'user_message', id: userMsgId, content: message })}\n\n`);

      // Stream from Workshop LLM
      const streamingClient = brainstormingService.getStreamingClient();
      /** True once we emit a terminal `done` SSE frame (LLM or fallback). */
      let sseDoneSent = false;
      let assistantMsgId: string | null = null;

      for await (const event of streamingClient.streamClarification(draft, message)) {
        if (event.type === 'done' && event.done) {
          // Save final draft state
          if (event.designSummary) {
            draft.status = 'design_ready';
            draft.designSummary = event.designSummary;
            draft.confidenceScore = 0.9;
            // 不把 JSON/代码块写入对话历史：摘要只在右侧面板展示
            const assistantDoneText =
              '设计方案摘要已生成，请在右侧面板查看并确认。';
            if (assistantMsgId) {
              const msg = draft.clarificationMessages.find(
                (m) => m.id === assistantMsgId
              );
              if (msg) {
                msg.content = assistantDoneText;
              }
            } else {
              for (let i = draft.clarificationMessages.length - 1; i >= 0; i--) {
                const m = draft.clarificationMessages[i];
                if (m.role === 'assistant') {
                  m.content = assistantDoneText;
                  break;
                }
              }
            }
          }
          draft.updatedAt = new Date().toISOString();
          await store.saveRequirementDraft(draft);

          res.write(`data: ${JSON.stringify({
            type: 'done',
            isComplete: event.isComplete,
            draft: draft
          })}\n\n`);
          sseDoneSent = true;
        } else if (event.content) {
          if (!assistantMsgId) {
            assistantMsgId = `msg_${Date.now()}_a`;
            draft.clarificationMessages.push({
              id: assistantMsgId,
              role: 'assistant',
              content: event.content,
              timestamp: new Date().toISOString(),
            });
          } else {
            // Append to existing message
            const lastMsg = draft.clarificationMessages[draft.clarificationMessages.length - 1];
            if (lastMsg && lastMsg.id === assistantMsgId) {
              lastMsg.content += event.content;
            }
          }

          res.write(`data: ${JSON.stringify({
            type: event.type,
            id: assistantMsgId,
            content: event.content,
            isComplete: false
          })}\n\n`);
        }
      }

      if (!sseDoneSent) {
        // Update confidence score based on exchange count
        const userMsgCount = draft.clarificationMessages.filter(m => m.role === 'user').length;
        draft.confidenceScore = Math.min(0.4 + (userMsgCount * 0.15), 0.85);
        draft.updatedAt = new Date().toISOString();
        await store.saveRequirementDraft(draft);
        // Always emit terminal `done` so the client merges `draft` and clears loading.
        res.write(`data: ${JSON.stringify({
          type: 'done',
          isComplete: false,
          draft,
        })}\n\n`);
      }

      res.end();
    } catch (err) {
      console.error('[Clarify Stream] Error:', err);
      res.write(`data: ${JSON.stringify({ type: 'error', error: String(err) })}\n\n`);
      res.end();
    }
  });

  // POST /api/intents/:id/confirm-design - Finalize design
  app.post('/api/intents/:id/confirm-design', async (req: Request, res: Response) => {
    try {
      const { modifications } = confirmDesignSchema.parse(req.body);
      const draft = await store.getRequirementDraftById(req.params.id as string);
      if (!draft) return res.status(404).json({ error: 'Intent not found' });

      if (modifications && draft.designSummary) {
        draft.designSummary = { ...draft.designSummary, ...modifications };
      }
      
      draft.status = 'design_approved';
      draft.updatedAt = new Date().toISOString();
      
      await store.saveRequirementDraft(draft);
      res.json(draft);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  // POST /api/intents/:id/generate-plan - Create implementation plan
  app.post('/api/intents/:id/generate-plan', async (req: Request, res: Response) => {
    const draft = await store.getRequirementDraftById(req.params.id as string);
    if (!draft) return res.status(404).json({ error: 'Intent not found' });

    const updatedDraft = await planGenerationService.generatePlan(draft);
    await store.saveRequirementDraft(updatedDraft);
    res.json(updatedDraft);
  });

  // POST /api/intents/:id/create-task - CONVERT DRAFT TO REAL TASK (PHASE 4)
  app.post('/api/intents/:id/create-task', async (req: Request, res: Response) => {
    try {
      const draft = await store.getRequirementDraftById(req.params.id as string);
      if (!draft || !draft.implementationPlan) {
        return res.status(400).json({ error: 'Intent not ready for task creation' });
      }

      const now = new Date().toISOString();
      const taskId = `task_${Date.now()}`;

      // Format the description beautifully in Markdown
      const ds = draft.designSummary || {} as any;
      const descriptionMarkdown = `### Source Requirement
> ${draft.rawInput}

### Design Summary

- **🎯 Goal**: ${ds.goal || 'N/A'}
- **👥 Target User**: ${ds.targetUser || 'N/A'}
- **🔄 Core Flow**: ${ds.coreFlow || 'N/A'}
- **📦 Deliverables**: ${ds.deliverables || 'N/A'}
- **🚧 Constraints**: ${ds.constraints || 'N/A'}
- **🛡️ Risks**: ${ds.risks || 'N/A'}

---
*This task was automatically generated via the Requirement Delivery intent wizard.*`;

      // 1. Create the TaskRecord
      const task: TaskRecord = {
        id: taskId,
        title: `Requirement Delivery: ${draft.designSummary?.goal || draft.rawInput.substring(0, 50)}`,
        description: descriptionMarkdown,
        taskType: 'general',
        priority: 'medium',
        status: 'created',
        executionMode: 'serial',
        approvalRequired: true,
        riskLevel: 'medium',
        requestedBy: 'user',
        requestedAt: now,
        recommendedAgentRole: 'product-manager',
        candidateAgentRoles: draft.implementationPlan.steps.map((s: any) => s.role),
        routeReason: 'Generated from requirement delivery wizard',
        routingStatus: 'matched',
        intentId: draft.id,
        createdAt: now,
        updatedAt: now,
      };

      await store.saveTask(task);

      // 2. Create TaskAssignments FIRST so we have IDs to link to workflow plan steps
      const activeIds = new Set(store.getActiveIds());
      const assignmentsMap: Record<string, TaskAssignment> = {};

      // Auto-activate the preset to hire any missing agents
      try {
        const { activatePreset } = await import('../orchestration/mvp-preset');
        const scanner = new (await import('../scanner')).Scanner();
        const presetName = draft.implementationPlan.scenario || 'feature-delivery';
        activatePreset(presetName, store as any, scanner);

        // Refresh active IDs after activation
        store.getActiveIds().forEach(id => activeIds.add(id));
      } catch (err) {
        console.warn('[Intents] Preset activation failed, falling back to manual assignment:', err);
      }

      for (const step of draft.implementationPlan.steps) {
        const assignment: TaskAssignment = {
          id: `asgn_${taskId}_${step.id}`,
          taskId: taskId,
          agentId: step.role,
          assignmentRole: step.role as TaskAssignmentRole,
          status: 'pending',
          startedAt: undefined,
          endedAt: undefined,
          resultSummary: undefined,
        };
        assignmentsMap[step.id] = assignment;
        await store.saveTaskAssignment(assignment);
      }

      // 3. Create WorkflowPlan with assignmentId links
      const workflowPlan: WorkflowPlan = {
        id: `plan_${taskId}`,
        taskId: taskId,
        mode: 'serial',
        synthesisRequired: true,
        steps: draft.implementationPlan.steps.map((s: any) => ({
          id: s.id,
          title: s.goal,
          assignmentRole: s.role,
          assignmentId: assignmentsMap[s.id].id,
          agentId: s.role,
          status: 'pending',
          order: s.order,
        })),
      };

      await store.saveWorkflowPlan(workflowPlan);

      // 4. Update draft status
      draft.status = 'completed';
      draft.createdTaskId = taskId;
      draft.updatedAt = now;
      await store.saveRequirementDraft(draft);

      res.status(201).json({ taskId, draft });
    } catch (err) {
      console.error('Failed to create task:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // DELETE /api/intents/:id - Cancel draft
  app.delete('/api/intents/:id', async (req: Request, res: Response) => {
    const draft = await store.getRequirementDraftById(req.params.id as string);
    if (!draft) return res.status(404).json({ error: 'Intent not found' });

    draft.status = 'cancelled';
    draft.updatedAt = new Date().toISOString();
    await store.saveRequirementDraft(draft);
    res.json({ success: true, draft });
  });
}
