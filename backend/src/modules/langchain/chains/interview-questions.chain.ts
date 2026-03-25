import { JsonOutputParser } from "@langchain/core/output_parsers";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";
import {
  buildCandidateProfileInterviewDisplayKo,
  buildGapAnalysisDisplayKo,
  buildJobPostingProfileDisplayKo,
  toPrioritizedProjectContextDisplayKo
} from "../interview-display-label-ko.util";
import { CandidateProfile, GapAnalysis, InterviewReportItem, JobPostingProfile } from "../workflow.types";

const interviewSchema = z.object({
  items: z.array(
    z.object({
      section: z.enum(["core", "deep"]),
      question: z.string(),
      whyAsked: z.string(),
      answerPoints: z.array(z.string()).min(2).max(3),
      modelAnswer: z.string(),
      caution: z.string().optional()
    })
  ).length(5)
});

function toSingleSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const split = trimmed.split(/(?<=[.!?。！？])\s+/).filter(Boolean);
  const first = (split[0] ?? trimmed).trim();
  return first;
}

function normalizeInterviewItems(items: InterviewReportItem[]): InterviewReportItem[] {
  return items.map((item) => ({
    ...item,
    whyAsked: toSingleSentence(item.whyAsked),
    answerPoints: (item.answerPoints ?? []).map((p) => p.trim()).filter(Boolean).slice(0, 3)
  }));
}

export async function runInterviewQuestionsChain(
  llm: BaseChatModel,
  candidate: CandidateProfile,
  job: JobPostingProfile,
  prioritizedProjectContext?: string,
  gapAnalysis?: GapAnalysis
): Promise<InterviewReportItem[]> {
  const jobDisplayKo = buildJobPostingProfileDisplayKo(job);
  const candidateDisplayKo = buildCandidateProfileInterviewDisplayKo(candidate);
  const gapDisplayKo = gapAnalysis ? buildGapAnalysisDisplayKo(gapAnalysis) : { matchedSignals: [], missingSignals: [], weakEvidence: [] };
  const projectContextDisplayKo = toPrioritizedProjectContextDisplayKo(prioritizedProjectContext);

  const parser = new JsonOutputParser<{ items: InterviewReportItem[] }>();
  const prompt = PromptTemplate.fromTemplate(
    [
      "You generate Korean interview prep report cards for hiring managers.",
      "Interview question generation MUST be role-agnostic: adapt naturally to engineering, design, marketing, operations, PM, research, data, and other roles using ONLY JD signals and candidate evidence.",
      "Do NOT optimize for developer/engineering roles. Do NOT over-weight technology stack keywords (frameworks, languages, tools) when forming questions — treat stack as supporting detail unless the JD explicitly centers on it.",
      "Purpose: verify execution evidence, problem-solving/decision-making, collaboration/ownership, and outcome/validation — NOT to collect missing CV facts or quiz buzzwords.",
      "",
      "STRICT differentiation from 'follow-up' questions (analysis step):",
      "- Follow-up questions = short prompts to fill gaps in written application evidence.",
      "- Interview questions HERE = depth suitable for any role: trade-offs, stakeholders, scope, validation, and results — never generic 'list the stack' drills.",
      "- Do NOT copy the same wording style as gap-filling prompts. Avoid 'OO 경험을 더 자세히 적어주세요' style.",
      "",
      "Balance across five cards (spread across core+deep; a card may touch two themes but avoid five near-duplicate tech probes):",
      "1) Execution evidence — what they actually did, scope, constraints, deliverables (grounded in resume/portfolio/project text).",
      "2) Problem-solving / decision-making — framing, options considered, criteria, trade-offs (when inputs contain any plausible hook; if absent, ask a JD-aligned hypothetical without inventing their past).",
      "3) Collaboration / ownership — stakeholders, handoffs, conflict/priority handling, responsibility boundaries (when inputs suggest teamwork or cross-functional work; otherwise keep JD-aligned and non-stereotyped).",
      "4) Outcome / validation — how they measured success, feedback, quality checks, before/after (when inputs mention results or validation; if thin, ask how they would validate without fabricating metrics).",
      "Use actual JD requirements (responsibilities, evaluation signals, role context) AND concrete candidate evidence. Do not invent employers, products, scale, or tools not present in inputs.",
      "Hard requirements when inputs contain matching hooks:",
      "- If candidate or JD text supports problem-solving/decision-making depth, at least ONE question must clearly target that dimension.",
      "- If candidate or JD text supports collaboration/ownership/stakeholders, at least ONE question must clearly target that dimension.",
      "- If candidate or JD text supports outcomes or validation, at least ONE question must clearly target that dimension.",
      "If a dimension has no support in inputs, do not force a clichéd question for it; stay honest and JD-grounded.",
      "",
      "Prioritized project context:",
      "- If it exists, include at least one (preferably two) questions that probe THAT body of work concretely: scope, stakeholders, constraints, decisions, and outcomes as appropriate to the domain (not assuming software architecture unless inputs indicate it).",
      "",
      "Gap JSON:",
      "- Use weakEvidence and missingSignals as verification themes, not as a checklist of stack trivia.",
      "",
      "Output shape:",
      "- Return exactly 5 items: first 3 are core(핵심 질문), last 2 are deep(심화 질문).",
      "- For each item, include concise fields: section, question, whyAsked, answerPoints, modelAnswer, caution(optional).",
      "- whyAsked must be EXACTLY ONE short Korean sentence that connects JD + candidate evidence (resume/portfolio/project) + gap themes when relevant. No repetition.",
      "- answerPoints must be practical preparation bullets (max 3 items), not paraphrasing the question.",
      "- modelAnswer must be 4~6 Korean lines, realistic, non-exaggerated, and based only on provided evidence.",
      "- Add caution when overstatement risk exists (claims of scale, impact, seniority, or tools not clearly supported by inputs).",
      "",
      "URL / live service questions:",
      "- Do NOT ask for a live URL, demo link, or portfolio site unless the candidate or project text explicitly mentions deployment, production URL, or public demo.",
      "- If no URL is evidenced, ask about how they validated quality (reviews, tests, metrics, stakeholder feedback) appropriate to the role.",
      "",
      "Do not assume fixed role families (frontend/backend/fullstack/etc.) unless explicitly stated in inputs.",
      "Do not assume RAG/agents/production scale unless explicitly stated in inputs.",
      "",
      "KOREAN-ONLY OUTPUT (critical):",
      "- Every user-facing string MUST be natural Korean: question, whyAsked, each answerPoints bullet, modelAnswer, and caution.",
      "- Do NOT paste raw English JD requirement lines, English skill bullets, or English fragments inside Korean sentences.",
      "- Do NOT wrap English requirement text in quotation marks inside Korean output.",
      "- When referencing a requirement, paraphrase using ONLY the Korean wording already present in job_display_ko / gap_display_ko / candidate_display_ko (e.g. TypeScript 기반 웹 개발 경험). If a topic has no Korean label there, describe it in your own Korean words without exposing English source text.",
      "",
      "Inputs below are Korean display-layer copies for interview generation (internal canonical JSON may exist elsewhere but is NOT shown here).",
      "Return strict JSON only.",
      "{format_instructions}",
      "candidate_display_ko JSON: {candidate_display_ko}",
      "job_display_ko JSON: {job_display_ko}",
      "gap_display_ko JSON: {gap_display_ko}",
      "prioritized_project_context_display_ko: {prioritized_project_context_display_ko}"
    ].join("\n")
  );
  const chain = RunnableSequence.from([prompt, llm, parser]);
  const parsed = interviewSchema.parse(
    await chain.invoke({
      format_instructions:
        "Field: items (array of exactly 5 objects: section(core|deep), question, whyAsked, answerPoints(2~3), modelAnswer, caution optional). All string values must be Korean only.",
      candidate_display_ko: JSON.stringify(candidateDisplayKo),
      job_display_ko: JSON.stringify(jobDisplayKo),
      gap_display_ko: JSON.stringify(gapDisplayKo),
      prioritized_project_context_display_ko: projectContextDisplayKo
    })
  );
  return normalizeInterviewItems(parsed.items);
}
