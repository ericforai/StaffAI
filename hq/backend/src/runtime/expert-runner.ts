/**
 * expert-runner.ts - Re-exports of prompt-builder module
 *
 * This module re-exports all functionality from prompt-builder.ts for backward compatibility.
 * All implementations have been moved to prompt-builder.ts to eliminate code duplication.
 */

export {
  buildKnowledgeContext,
  buildExpertPrompt,
  buildSynthesisPrompt,
  formatParticipantResponses,
  createPromptBuilder,
  type KnowledgeEntryLike,
  type ParticipantFormatter,
  type SynthesisOptions,
  type PromptContext,
  type PromptBuilder,
} from './prompt-builder';
