/**
 * ai-prompts.ts
 * Centralized prompt templates for every AI task. Keeping prompts here
 * (rather than inline in each service) makes them easy to tune/version
 * without touching business logic.
 */

import { AiTaskType, AiGenerationRequest } from "../../models/resume.model";

const BASE_RULES = `You are an expert resume writer and career coach. Follow these rules strictly:
- Never invent facts, numbers, companies, or dates that are not implied by the input.
- Write in confident, professional, active voice.
- Start bullet points with a strong action verb.
- Prefer quantified impact (%, $, time saved, scale) when the input supports it — do not fabricate numbers.
- Avoid buzzword clichés like "team player", "hard worker", "go-getter".
- Keep output concise. No preamble, no explanation, no markdown formatting unless asked.`;

export function buildPrompt(request: AiGenerationRequest): string {
  const { task, input, context } = request;
  const roleContext = context?.targetRole ? `Target role: ${context.targetRole}.` : "";
  const jdContext = context?.jobDescription
    ? `Job description for alignment:\n${context.jobDescription.slice(0, 3000)}`
    : "";
  const toneContext = context?.tone ? `Tone: ${context.tone}.` : "";

  const taskInstructions: Record<AiTaskType, string> = {
    improve_summary: `Rewrite this resume summary into a complete, polished professional summary paragraph (4-6 sentences). Cover: who they are professionally, their core technical strengths, the type of impact/value they bring, and what they are looking for or focused on next. Do not pad with filler — every sentence should add real information:\n${input}`,
    rewrite_experience: `Rewrite this work experience bullet to be more impactful and specific:\n${input}`,
    improve_project: `Rewrite this project description/bullet to highlight technical impact:\n${input}`,
    improve_skills: `Given this raw skills list, group and clean it into logical categories:\n${input}`,
    generate_achievement: `Based on this raw note, write one polished achievement bullet:\n${input}`,
    optimize_keywords: `Rewrite this resume bullet to naturally include relevant keywords for the target role/job description, without keyword stuffing:\n${input}`,
    suggest_missing_skills: `Given this resume content and target role, list 5-10 relevant skills that appear to be missing:\n${input}`,
    improve_grammar: `Fix grammar, tense consistency, and awkward phrasing in this text. Preserve meaning exactly:\n${input}`,
    improve_readability: `Rewrite this text to be clearer and easier to scan, without changing its meaning:\n${input}`,
    reduce_repetition: `This resume repeats similar phrasing/verbs across bullets. Rewrite to vary word choice while preserving meaning:\n${input}`,
    generate_internship: `Based on this raw description of an internship, write 3 polished, quantified bullet points:\n${input}`,
    generate_cover_letter: `Write a concise, specific, one-page cover letter using this resume content and job description. Avoid generic phrases:\n${input}`,
    generate_linkedin_about: `Write a LinkedIn "About" section (first person, 3-4 short paragraphs) based on this resume content:\n${input}`,
    generate_portfolio_bio: `Write a short portfolio website bio (2-3 sentences, third person optional) based on this resume content:\n${input}`,
    generate_github_bio: `Write a concise GitHub profile bio (under 160 characters) based on this resume content:\n${input}`,
    humanize: `Rewrite this text so it reads naturally and human-written, removing robotic or AI-sounding phrasing, while preserving all facts and meaning:\n${input}`,
  };

  return [BASE_RULES, roleContext, toneContext, jdContext, "", taskInstructions[task]]
    .filter(Boolean)
    .join("\n");
}

export function buildAtsAnalysisPrompt(resumeText: string, jobDescription?: string): string {
  return `${BASE_RULES}

You are also an ATS (Applicant Tracking System) analysis engine. Analyze the following resume text${
    jobDescription ? " against the job description below" : ""
  }.

Return ONLY valid JSON matching this shape, no markdown fences:
{
  "weakSentences": string[],   // bullets that are vague or unimpactful, quoted verbatim
  "missingContent": string[],  // things a strong resume in this field would have but this one lacks
  "grammarIssues": string[],   // specific grammar/tense problems found, quoted verbatim
  "suggestedKeywords": string[] // keywords relevant to the role/JD not present in resume
}

Resume text:
${resumeText.slice(0, 6000)}

${jobDescription ? `Job description:\n${jobDescription.slice(0, 3000)}` : ""}`;
}
