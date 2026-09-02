/**
 * lib/project-generator/models/enums.ts
 *
 * Canonical enums shared across the entire Project Generator backend.
 * These are the single source of truth for string-literal unions used by
 * every other model, service, prompt and validator in this module.
 */

export enum ProjectDomain {
  AI = "ai",
  MACHINE_LEARNING = "machine_learning",
  DEEP_LEARNING = "deep_learning",
  LLM = "llm",
  WEB_APP = "web_app",
  ANDROID = "android",
  IOS = "ios",
  FLUTTER = "flutter",
  REACT_NATIVE = "react_native",
  NEXTJS = "nextjs",
  PYTHON = "python",
  JAVA = "java",
  CPP = "cpp",
  RUST = "rust",
  GO = "go",
  CYBER_SECURITY = "cyber_security",
  BLOCKCHAIN = "blockchain",
  IOT = "iot",
  CLOUD = "cloud",
  DATA_SCIENCE = "data_science",
  DEVOPS = "devops",
  AR = "ar",
  VR = "vr",
  GAME_DEVELOPMENT = "game_development",
  COMPUTER_VISION = "computer_vision",
  NLP = "nlp",
}

export enum GenerationSourceType {
  IDEA = "idea",
  PROMPT = "prompt",
  PROBLEM_STATEMENT = "problem_statement",
  PDF = "pdf",
  RESEARCH_PAPER = "research_paper",
  IMAGE = "image",
  VOICE = "voice",
  FLOWCHART = "flowchart",
}

export enum GenerationStatus {
  QUEUED = "queued",
  PARSING_SOURCE = "parsing_source",
  GENERATING_SPEC = "generating_spec",
  GENERATING_ARCHITECTURE = "generating_architecture",
  GENERATING_DATABASE = "generating_database",
  GENERATING_API = "generating_api",
  GENERATING_ROADMAP = "generating_roadmap",
  GENERATING_DIAGRAMS = "generating_diagrams",
  GENERATING_DOCS = "generating_docs",
  ASSEMBLING_EXPORT = "assembling_export",
  COMPLETED = "completed",
  FAILED = "failed",
}

export enum DifficultyLevel {
  BEGINNER = "beginner",
  INTERMEDIATE = "intermediate",
  ADVANCED = "advanced",
  EXPERT = "expert",
}

export enum ProjectScale {
  PROTOTYPE = "prototype",
  MVP = "mvp",
  PRODUCTION = "production",
  ENTERPRISE = "enterprise",
}

export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH",
  DELETE = "DELETE",
}

export enum AuthStrategy {
  NONE = "none",
  JWT = "jwt",
  SESSION_COOKIE = "session_cookie",
  OAUTH2 = "oauth2",
  API_KEY = "api_key",
  SUPABASE_AUTH = "supabase_auth",
  MAGIC_LINK = "magic_link",
}

export enum DatabaseColumnType {
  UUID = "uuid",
  TEXT = "text",
  VARCHAR = "varchar",
  INTEGER = "integer",
  BIGINT = "bigint",
  NUMERIC = "numeric",
  BOOLEAN = "boolean",
  TIMESTAMP = "timestamptz",
  DATE = "date",
  JSONB = "jsonb",
  ARRAY_TEXT = "text[]",
  ENUM = "enum",
}

export enum DiagramType {
  FLOWCHART = "flowchart",
  MERMAID_ER = "mermaid_er",
  CLASS_DIAGRAM = "class_diagram",
  SEQUENCE_DIAGRAM = "sequence_diagram",
  USE_CASE_DIAGRAM = "use_case_diagram",
  SYSTEM_ARCHITECTURE = "system_architecture",
  DATABASE_DIAGRAM = "database_diagram",
  FOLDER_DIAGRAM = "folder_diagram",
}

export enum DeploymentTarget {
  VERCEL = "vercel",
  RAILWAY = "railway",
  RENDER = "render",
  DOCKER = "docker",
  AWS = "aws",
  AZURE = "azure",
  GOOGLE_CLOUD = "google_cloud",
  SUPABASE = "supabase",
}

export enum TestType {
  UNIT = "unit",
  INTEGRATION = "integration",
  API = "api",
  EDGE_CASE = "edge_case",
  E2E = "e2e",
}

export enum SecurityControlCategory {
  RATE_LIMITING = "rate_limiting",
  INPUT_VALIDATION = "input_validation",
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  RBAC = "rbac",
  INPUT_SANITIZATION = "input_sanitization",
  SECRETS_MANAGEMENT = "secrets_management",
  TRANSPORT_SECURITY = "transport_security",
}

export enum ExportFormat {
  MARKDOWN = "markdown",
  PDF = "pdf",
  DOCX = "docx",
  HTML = "html",
  JSON = "json",
  ZIP = "zip",
}

export enum TaskPriority {
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}

export enum RoadmapPhaseName {
  PHASE_1 = "phase_1",
  PHASE_2 = "phase_2",
  PHASE_3 = "phase_3",
  PHASE_4 = "phase_4",
}

export enum LicenseType {
  MIT = "MIT",
  APACHE_2_0 = "Apache-2.0",
  GPL_3_0 = "GPL-3.0",
  BSD_3_CLAUSE = "BSD-3-Clause",
  UNLICENSED = "UNLICENSED",
  PROPRIETARY = "Proprietary",
}
