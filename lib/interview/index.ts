/**
 * lib/interview/index.ts
 * Public surface of the Interview Intelligence Engine module.
 */

// Models
export * from "./models/interview.model";

// Validation
export * from "../validations/interview";

// Generation
export { generateInterviewQuestions } from "./generator/question-generator.service";
export { buildQuestionGenPrompt } from "./prompts/generation";

// Evaluation
export { evaluateAnswer, averageScore } from "./evaluation/evaluation.service";

// Skill gap / roadmap
export {
  buildSkillGapRoadmap,
  computeSkillScores,
  splitWeakAndStrong,
  type ScoredQuestion,
} from "./skillgap/skillgap.service";

// Company context
export { getCompanyContext, companyContextToPromptContext } from "./company/company.service";

// Analytics
export { recordAttempt, computeAnalyticsSnapshot } from "./analytics/analytics.service";

// Session orchestration
export {
  createSession,
  submitAndEvaluateAnswer,
  completeSession,
  type CreateSessionParams,
  type SubmitAndEvaluateResult,
} from "./services/session.service";

// Export / reporting
export {
  buildMarkdownReport,
  buildJsonReport,
  buildPdfReport,
  buildDocxReport,
  type SessionReportBundle,
} from "./export/export.service";
export { loadSessionReportBundle } from "./export/report-loader";
