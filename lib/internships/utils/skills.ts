import { collapseWhitespace, tokenize } from './text';

/**
 * Canonical skill vocabulary + alias table.
 * Deterministic extraction runs first; the AI layer only fills gaps, which keeps
 * per-posting cost near zero at aggregation scale.
 */
const SKILL_ALIASES: Record<string, string> = {
  js: 'JavaScript', javascript: 'JavaScript', ecmascript: 'JavaScript',
  ts: 'TypeScript', typescript: 'TypeScript',
  py: 'Python', python: 'Python', python3: 'Python',
  reactjs: 'React', 'react.js': 'React', react: 'React',
  nextjs: 'Next.js', 'next.js': 'Next.js', next: 'Next.js',
  nodejs: 'Node.js', 'node.js': 'Node.js', node: 'Node.js',
  postgres: 'PostgreSQL', postgresql: 'PostgreSQL', psql: 'PostgreSQL',
  mongo: 'MongoDB', mongodb: 'MongoDB',
  k8s: 'Kubernetes', kubernetes: 'Kubernetes',
  ml: 'Machine Learning', 'machine learning': 'Machine Learning',
  dl: 'Deep Learning', 'deep learning': 'Deep Learning',
  nlp: 'NLP', 'natural language processing': 'NLP',
  cv: 'Computer Vision', 'computer vision': 'Computer Vision',
  ai: 'Artificial Intelligence', genai: 'Generative AI', 'gen ai': 'Generative AI',
  llm: 'LLMs', llms: 'LLMs',
  aws: 'AWS', gcp: 'GCP', azure: 'Azure',
  ci: 'CI/CD', 'ci/cd': 'CI/CD', devops: 'DevOps',
  rest: 'REST APIs', 'restful': 'REST APIs', graphql: 'GraphQL',
  sql: 'SQL', nosql: 'NoSQL', redis: 'Redis',
  docker: 'Docker', git: 'Git', github: 'Git', linux: 'Linux',
  figma: 'Figma', ux: 'UX Design', ui: 'UI Design',
  seo: 'SEO', sem: 'SEM', 'google analytics': 'Google Analytics',
  excel: 'Excel', 'power bi': 'Power BI', powerbi: 'Power BI', tableau: 'Tableau',
  pandas: 'Pandas', numpy: 'NumPy', pytorch: 'PyTorch', tensorflow: 'TensorFlow',
  sklearn: 'scikit-learn', 'scikit-learn': 'scikit-learn',
  java: 'Java', 'c++': 'C++', cpp: 'C++', 'c#': 'C#', csharp: 'C#', golang: 'Go',
  rust: 'Rust', kotlin: 'Kotlin', swift: 'Swift', php: 'PHP', ruby: 'Ruby', scala: 'Scala',
  django: 'Django', flask: 'Flask', fastapi: 'FastAPI', spring: 'Spring Boot',
  'spring boot': 'Spring Boot', express: 'Express.js', tailwind: 'Tailwind CSS',
  html: 'HTML', css: 'CSS', sass: 'Sass', 'react native': 'React Native',
  flutter: 'Flutter', android: 'Android', ios: 'iOS',
  supabase: 'Supabase', firebase: 'Firebase', prisma: 'Prisma',
  terraform: 'Terraform', jenkins: 'Jenkins', kafka: 'Kafka', spark: 'Apache Spark',
  hadoop: 'Hadoop', airflow: 'Apache Airflow', dbt: 'dbt',
  'data analysis': 'Data Analysis', 'data science': 'Data Science',
  'product management': 'Product Management', 'content writing': 'Content Writing',
  'copywriting': 'Copywriting', 'social media': 'Social Media Marketing',
  'digital marketing': 'Digital Marketing', canva: 'Canva',
  photoshop: 'Adobe Photoshop', illustrator: 'Adobe Illustrator',
  'premiere pro': 'Adobe Premiere Pro', 'after effects': 'Adobe After Effects',
  'business development': 'Business Development', sales: 'Sales',
  'financial modeling': 'Financial Modeling', accounting: 'Accounting',
  'communication': 'Communication', 'problem solving': 'Problem Solving',
  'project management': 'Project Management', agile: 'Agile', scrum: 'Scrum',
  matlab: 'MATLAB', autocad: 'AutoCAD', solidworks: 'SolidWorks', catia: 'CATIA',
  vlsi: 'VLSI', verilog: 'Verilog', vhdl: 'VHDL', embedded: 'Embedded Systems',
  iot: 'IoT', robotics: 'Robotics', plc: 'PLC',
};

const MULTIWORD_KEYS = Object.keys(SKILL_ALIASES)
  .filter((k) => k.includes(' '))
  .sort((a, b) => b.length - a.length);

export function canonicalizeSkill(input: string): string | null {
  const key = collapseWhitespace(input).toLowerCase();
  if (!key) return null;
  const alias = SKILL_ALIASES[key];
  if (alias) return alias;
  // Preserve unknown-but-plausible skills (2–40 chars, not a stopword fragment).
  if (key.length >= 2 && key.length <= 40 && /[a-z]/.test(key)) {
    return collapseWhitespace(input).replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return null;
}

export function extractSkills(...sources: Array<string | null | undefined>): string[] {
  const text = sources.filter(Boolean).join(' \n ').toLowerCase();
  if (!text) return [];
  const found = new Set<string>();

  for (const phrase of MULTIWORD_KEYS) {
    if (text.includes(phrase)) found.add(SKILL_ALIASES[phrase] as string);
  }
  for (const token of tokenize(text)) {
    const alias = SKILL_ALIASES[token];
    if (alias) found.add(alias);
  }
  return [...found].sort();
}

export function dedupeSkills(skills: readonly string[]): string[] {
  const out = new Map<string, string>();
  for (const skill of skills) {
    const canonical = canonicalizeSkill(skill);
    if (!canonical) continue;
    out.set(canonical.toLowerCase(), canonical);
  }
  return [...out.values()].sort();
}

export function mergeSkills(a: readonly string[], b: readonly string[]): string[] {
  return dedupeSkills([...a, ...b]);
}
