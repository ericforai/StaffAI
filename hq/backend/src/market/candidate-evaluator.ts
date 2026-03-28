/**
 * Candidate Evaluator Service
 *
 * Evaluates GitHub repository candidates as potential agent specialists.
 * Provides multi-criteria scoring based on code quality, activity, documentation,
 * community adoption, and relevance to task requirements.
 *
 * @module market/candidate-evaluator
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Evaluation configuration with customizable weights and thresholds
 */
export interface EvaluatorConfig {
  /** Weight for code quality signals (0-1) */
  codeQualityWeight: number;
  /** Weight for activity/maintenance signals (0-1) */
  activityWeight: number;
  /** Weight for documentation completeness (0-1) */
  documentationWeight: number;
  /** Weight for community adoption (0-1) */
  communityWeight: number;
  /** Weight for task relevance (0-1) */
  relevanceWeight: number;
  /** Minimum days since last update to consider active */
  activeDaysThreshold: number;
  /** Minimum stars to consider established */
  establishedStarsThreshold: number;
  /** Enable bonus points for matching keywords */
  keywordBonusEnabled: boolean;
  /** Penalty for missing README */
  missingReadmePenalty: number;
  /** Penalty for missing CONTRIBUTING guide */
  missingContributingPenalty: number;
}

/**
 * Individual score breakdown for transparency
 */
export interface ScoreBreakdown {
  /** Raw code quality score (0-100) */
  codeQuality: number;
  /** Raw activity score (0-100) */
  activity: number;
  /** Raw documentation score (0-100) */
  documentation: number;
  /** Raw community score (0-100) */
  community: number;
  /** Raw relevance score (0-100) */
  relevance: number;
  /** Final weighted score (0-100) */
  final: number;
}

/**
 * Evaluation result with score and context
 */
export interface CandidateEvaluation {
  /** Repository URL */
  url: string;
  /** Repository owner/name */
  fullName: string;
  /** Final score (0-100) */
  score: number;
  /** Score breakdown by category */
  breakdown: ScoreBreakdown;
  /** Quality tier classification */
  tier: 'excellent' | 'good' | 'fair' | 'poor';
  /** Key strengths identified */
  strengths: string[];
  /** Potential concerns identified */
  concerns: string[];
  /** Recommendation level */
  recommendation: 'highly-recommended' | 'recommended' | 'cautious' | 'not-recommended';
}

/**
 * Relevance keywords for matching task requirements
 */
export interface RelevanceKeywords {
  /** Programming languages */
  languages?: string[];
  /** Framework names */
  frameworks?: string[];
  /** Domain-specific terms */
  domains?: string[];
  /** Technology keywords */
  technologies?: string[];
}

/**
 * Input parameters for candidate evaluation
 */
export interface EvaluationInput {
  /** Repository to evaluate */
  repo: GitHubRepo;
  /** Task description for relevance scoring */
  taskDescription?: string;
  /** Optional relevance keywords */
  keywords?: RelevanceKeywords;
  /** Custom configuration override */
  config?: Partial<EvaluatorConfig>;
}

/**
 * Simplified GitHub repository interface
 */
export interface GitHubRepo {
  url: string;
  owner: string;
  name: string;
  description?: string;
  language?: string;
  stars: number;
  forks: number;
  updatedAt: string;
  topics: string[];
  hasReadme: boolean;
  hasContributing: boolean;
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Default evaluation configuration
 *
 * Weights prioritize code quality and activity for specialist selection,
 * with documentation as a strong signal of maintainability.
 */
export const DEFAULT_CONFIG: EvaluatorConfig = {
  codeQualityWeight: 0.25,
  activityWeight: 0.25,
  documentationWeight: 0.20,
  communityWeight: 0.15,
  relevanceWeight: 0.15,
  activeDaysThreshold: 90, // Updated within 3 months = active
  establishedStarsThreshold: 50, // 50+ stars = established
  keywordBonusEnabled: true,
  missingReadmePenalty: 30,
  missingContributingPenalty: 15,
} as const;

/**
 * Predefined configurations for different evaluation scenarios
 */
export const CONFIG_PRESETS: Record<string, Partial<EvaluatorConfig>> = {
  /** Prioritize active maintenance for long-term projects */
  maintenance: {
    activityWeight: 0.35,
    documentationWeight: 0.25,
    codeQualityWeight: 0.20,
    communityWeight: 0.10,
    relevanceWeight: 0.10,
  },
  /** Prioritize community adoption for popular tools */
  popular: {
    communityWeight: 0.35,
    codeQualityWeight: 0.25,
    activityWeight: 0.20,
    documentationWeight: 0.10,
    relevanceWeight: 0.10,
  },
  /** Prioritize documentation for educational specialists */
  educational: {
    documentationWeight: 0.40,
    codeQualityWeight: 0.20,
    activityWeight: 0.15,
    communityWeight: 0.10,
    relevanceWeight: 0.15,
  },
  /** Balanced scoring for general purpose */
  balanced: {
    codeQualityWeight: 0.20,
    activityWeight: 0.20,
    documentationWeight: 0.20,
    communityWeight: 0.20,
    relevanceWeight: 0.20,
  },
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate days since a given ISO timestamp
 */
function daysSince(timestamp: string): number {
  const updated = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - updated.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Normalize a value to 0-100 range using logarithmic scale
 * Useful for star counts which follow power law distribution
 */
function logNormalize(value: number, maxValue: number): number {
  if (value <= 0) return 0;
  const logValue = Math.log10(value + 1);
  const logMax = Math.log10(maxValue + 1);
  return Math.min(100, (logValue / logMax) * 100);
}

/**
 * Calculate keyword match score between texts
 */
function calculateKeywordMatch(text: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;

  const lowerText = text.toLowerCase();
  let matchCount = 0;

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();
    if (lowerText.includes(lowerKeyword)) {
      matchCount++;
    }
  }

  return (matchCount / keywords.length) * 100;
}

/**
 * Extract all keywords from relevance structure
 */
function extractKeywords(input: RelevanceKeywords | undefined): string[] {
  if (!input) return [];

  return [
    ...(input.languages ?? []),
    ...(input.frameworks ?? []),
    ...(input.domains ?? []),
    ...(input.technologies ?? []),
  ];
}

// =============================================================================
// Score Calculation Functions
// =============================================================================

/**
 * Calculate code quality score
 *
 * Factors:
 * - Fork-to-star ratio (indicates code usability)
 * - Has README (project documentation)
 * - Has CONTRIBUTING (developer experience)
 */
function calculateCodeQuality(
  repo: GitHubRepo,
  config: EvaluatorConfig
): number {
  let score = 50; // Base score

  // Fork-to-star ratio indicates code quality and reusability
  // A healthy fork-to-star ratio is typically 0.1 to 0.3
  if (repo.stars > 0) {
    const forkRatio = repo.forks / repo.stars;
    if (forkRatio >= 0.1 && forkRatio <= 0.5) {
      score += 20;
    } else if (forkRatio > 0) {
      score += 10;
    }
  }

  // README is critical for code quality assessment
  if (repo.hasReadme) {
    score += 15;
  } else {
    score -= config.missingReadmePenalty;
  }

  // CONTRIBUTING guide shows mature development practices
  if (repo.hasContributing) {
    score += 15;
  } else {
    score -= config.missingContributingPenalty;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate activity score
 *
 * Factors:
 * - Days since last update
 * - Recent commits (inferred from update recency)
 */
function calculateActivity(
  repo: GitHubRepo,
  config: EvaluatorConfig
): number {
  const daysInactive = daysSince(repo.updatedAt);

  // Linear decay from 100 to 0 over activeDaysThreshold days
  const recencyScore = Math.max(
    0,
    100 - (daysInactive / config.activeDaysThreshold) * 100
  );

  // Bonus for very recent activity (within 7 days)
  const recentBonus = daysInactive <= 7 ? 10 : 0;

  return Math.min(100, recencyScore + recentBonus);
}

/**
 * Calculate documentation score
 *
 * Factors:
 * - README presence
 * - CONTRIBUTING presence
 * - Description quality (length check)
 * - Topics (as metadata documentation)
 */
function calculateDocumentation(repo: GitHubRepo): number {
  let score = 0;

  // README is foundational
  if (repo.hasReadme) {
    score += 40;
  }

  // CONTRIBUTING guide shows developer care
  if (repo.hasContributing) {
    score += 25;
  }

  // Description provides context
  if (repo.description && repo.description.length >= 50) {
    score += 15;
  } else if (repo.description) {
    score += 8;
  }

  // Topics serve as discoverability metadata
  if (repo.topics && repo.topics.length >= 3) {
    score += 10;
  } else if (repo.topics && repo.topics.length > 0) {
    score += 5;
  }

  // Homepage indicates maintained presence
  // (note: not in GitHubRepo interface but could be added)

  return Math.min(100, score);
}

/**
 * Calculate community score
 *
 * Factors:
 * - Star count (logarithmic scale)
 * - Fork count (logarithmic scale)
 * - Watch count (not available in current interface)
 */
function calculateCommunity(repo: GitHubRepo, config: EvaluatorConfig): number {
  // Use logarithmic scaling for stars (handles power law distribution)
  const starScore = logNormalize(repo.stars, 10000);

  // Forks indicate active usage and contribution
  const forkScore = logNormalize(repo.forks, 1000);

  // Combine with slight preference for stars
  return (starScore * 0.6 + forkScore * 0.4);
}

/**
 * Calculate relevance score
 *
 * Factors:
 * - Language match
 * - Description keyword match
 * - Topics keyword match
 * - Name keyword match
 */
function calculateRelevance(
  repo: GitHubRepo,
  taskDescription: string | undefined,
  keywords: RelevanceKeywords | undefined
): number {
  let score = 0;
  const allKeywords = extractKeywords(keywords);

  // Language matching
  if (keywords?.languages && keywords.languages.length > 0) {
    const languageLower = repo.language?.toLowerCase() ?? '';
    const languageMatches = keywords.languages.some(
      (lang) => languageLower.includes(lang.toLowerCase())
    );
    if (languageMatches) {
      score += 40;
    }
  }

  // Keyword matching in description
  if (repo.description) {
    const descriptionMatch = calculateKeywordMatch(
      repo.description,
      allKeywords
    );
    score += descriptionMatch * 0.25;
  }

  // Keyword matching in topics
  if (repo.topics && repo.topics.length > 0) {
    const topicsText = repo.topics.join(' ');
    const topicMatch = calculateKeywordMatch(topicsText, allKeywords);
    score += topicMatch * 0.2;
  }

  // Keyword matching in name
  const nameMatch = calculateKeywordMatch(repo.name, allKeywords);
  score += nameMatch * 0.15;

  // Task description similarity (if provided)
  if (taskDescription) {
    const repoText = [
      repo.name,
      repo.description ?? '',
      repo.language ?? '',
      ...repo.topics,
    ].join(' ').toLowerCase();

    const taskWords = taskDescription
      .toLowerCase()
      .split(/[\s,，.。!！?？\-_/():]+/)
      .filter((w) => w.length > 3);

    let wordMatches = 0;
    for (const word of taskWords) {
      if (repoText.includes(word)) {
        wordMatches++;
      }
    }

    if (taskWords.length > 0) {
      score += (wordMatches / taskWords.length) * 20;
    }
  }

  return Math.min(100, score);
}

// =============================================================================
// Main Evaluation Function
// =============================================================================

/**
 * Evaluate a GitHub repository candidate as a potential specialist
 *
 * @param input - Evaluation parameters including repository and context
 * @returns Detailed evaluation with scores and recommendations
 */
export function evaluateCandidate(input: EvaluationInput): CandidateEvaluation {
  const config: EvaluatorConfig = { ...DEFAULT_CONFIG, ...input.config };

  // Calculate individual scores
  const codeQuality = calculateCodeQuality(input.repo, config);
  const activity = calculateActivity(input.repo, config);
  const documentation = calculateDocumentation(input.repo);
  const community = calculateCommunity(input.repo, config);
  const relevance = calculateRelevance(
    input.repo,
    input.taskDescription,
    input.keywords
  );

  // Calculate weighted final score
  const final =
    codeQuality * config.codeQualityWeight +
    activity * config.activityWeight +
    documentation * config.documentationWeight +
    community * config.communityWeight +
    relevance * config.relevanceWeight;

  const breakdown: ScoreBreakdown = {
    codeQuality,
    activity,
    documentation,
    community,
    relevance,
    final: Math.round(final),
  };

  // Determine tier
  const tier = final >= 80
    ? 'excellent'
    : final >= 60
    ? 'good'
    : final >= 40
    ? 'fair'
    : 'poor';

  // Identify strengths
  const strengths: string[] = [];
  if (codeQuality >= 70) strengths.push('Strong code quality signals');
  if (activity >= 70) strengths.push('Active maintenance');
  if (documentation >= 70) strengths.push('Excellent documentation');
  if (community >= 70) strengths.push('Strong community adoption');
  if (relevance >= 70) strengths.push('Highly relevant to requirements');
  if (input.repo.hasContributing) strengths.push('Welcomes contributions');
  if (input.repo.stars >= config.establishedStarsThreshold) {
    strengths.push('Established project');
  }

  // Identify concerns
  const concerns: string[] = [];
  if (!input.repo.hasReadme) concerns.push('Missing README');
  if (!input.repo.hasContributing) concerns.push('No contribution guidelines');
  if (activity < 40) concerns.push('Low recent activity');
  if (codeQuality < 50) concerns.push('Limited code quality signals');
  if (community < 30 && input.repo.stars < 10) {
    concerns.push('Limited adoption');
  }

  // Determine recommendation
  const recommendation = final >= 80
    ? 'highly-recommended'
    : final >= 60
    ? 'recommended'
    : final >= 40
    ? 'cautious'
    : 'not-recommended';

  return {
    url: input.repo.url,
    fullName: `${input.repo.owner}/${input.repo.name}`,
    score: Math.round(final),
    breakdown,
    tier,
    strengths,
    concerns,
    recommendation,
  };
}

/**
 * Batch evaluate multiple candidates and sort by score
 *
 * @param candidates - Array of evaluation inputs
 * @returns Sorted array of evaluations (highest score first)
 */
export function evaluateCandidates(
  candidates: EvaluationInput[]
): CandidateEvaluation[] {
  const evaluations = candidates.map(evaluateCandidate);

  return evaluations.sort((a, b) => b.score - a.score);
}

/**
 * Get top N candidates from a batch
 *
 * @param candidates - Array of evaluation inputs
 * @param topN - Maximum number of candidates to return
 * @param minimumScore - Minimum score threshold (default: 40)
 * @returns Top N candidates meeting the threshold
 */
export function getTopCandidates(
  candidates: EvaluationInput[],
  topN: number,
  minimumScore = 40
): CandidateEvaluation[] {
  const evaluated = evaluateCandidates(candidates);

  return evaluated
    .filter((e) => e.score >= minimumScore)
    .slice(0, topN);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create evaluation input from GitHub repository
 */
export function createEvaluationInput(
  repo: GitHubRepo,
  taskDescription?: string,
  keywords?: RelevanceKeywords,
  preset?: string
): EvaluationInput {
  const config = preset ? CONFIG_PRESETS[preset] : undefined;

  return {
    repo,
    taskDescription,
    keywords,
    config,
  };
}

/**
 * Check if a candidate meets minimum quality standards
 */
export function meetsMinimumStandards(
  evaluation: CandidateEvaluation,
  minScore = 40
): boolean {
  return evaluation.score >= minScore &&
         evaluation.breakdown.activity >= 20 &&
         evaluation.breakdown.codeQuality >= 30;
}

/**
 * Format evaluation as human-readable summary
 */
export function formatEvaluationSummary(evaluation: CandidateEvaluation): string {
  const lines = [
    `**${evaluation.fullName}** - Score: ${evaluation.score}/100 (${evaluation.tier})`,
    '',
    'Strengths:',
    ...evaluation.strengths.map((s) => `  ✓ ${s}`),
    '',
    'Concerns:',
    ...evaluation.concerns.map((c) => `  ⚠ ${c}`),
    '',
    `Recommendation: ${evaluation.recommendation}`,
  ];

  return lines.filter((line) =>
    !line.startsWith('  ✓') || evaluation.strengths.length > 0
  ).filter((line) =>
    !line.startsWith('  ⚠') || evaluation.concerns.length > 0
  ).join('\n');
}
