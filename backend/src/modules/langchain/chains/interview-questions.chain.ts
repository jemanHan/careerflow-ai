import { JsonOutputParser } from "@langchain/core/output_parsers";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";
import { CandidateProfile, GapAnalysis, InterviewReportItem, JobPostingProfile } from "../workflow.types";

const interviewSchema = z.object({
  items: z.array(
    z.object({
      section: z.enum(["core", "deep"]),
      question: z.string(),
      whyAsked: z.string(),
      answerPoints: z.array(z.string()).min(2).max(4),
      modelAnswer: z.string(),
      caution: z.string().optional()
    })
  ).length(5)
});

export async function runInterviewQuestionsChain(
  llm: BaseChatModel,
  candidate: CandidateProfile,
  job: JobPostingProfile,
  prioritizedProjectContext?: string,
  gapAnalysis?: GapAnalysis
): Promise<InterviewReportItem[]> {
  const parser = new JsonOutputParser<{ items: InterviewReportItem[] }>();
  const prompt = PromptTemplate.fromTemplate(
    [
      "You generate Korean TECHNICAL INTERVIEW prep report cards for hiring managers.",
      "Purpose: simulate what an interviewer would ask to verify depth of ownership, trade-offs, and real delivery — NOT to collect missing CV facts.",
      "",
      "STRICT differentiation from 'follow-up' questions (analysis step):",
      "- Follow-up questions = short prompts to fill gaps in written application evidence (what to add to the resume).",
      "- Interview questions HERE = behavioral/technical depth: design rationale, metrics, failure modes, stakeholder trade-offs, how you would defend claims in a panel.",
      "- Do NOT copy the same wording style as gap-filling prompts. Avoid 'OO 경험을 더 자세히 적어주세요' style.",
      "",
      "Content rules:",
      "- Ground every question ONLY in candidate JSON, job JSON, gap JSON, and prioritized project context.",
      "- Prefer questions that probe: scope of responsibility, decision criteria, alternatives considered, validation/evidence, incident handling, JD-specific mapping.",
      "- Use weakEvidence and missingSignals from gap JSON as themes for verification/deep-dive, not as copy-paste checklist questions.",
      "- If prioritized project context exists, include at least 2 questions that test concrete understanding of THAT project (architecture, constraints, outcomes).",
      "- Return exactly 5 items: first 3 are core(핵심 질문), last 2 are deep(심화 질문).",
      "- For each item, include concise fields: section, question, whyAsked, answerPoints, modelAnswer, caution(optional).",
      "- whyAsked must connect to JD + candidate evidence (resume/portfolio/project) + gap themes when relevant.",
      "- answerPoints must be practical preparation bullets, not paraphrasing the question.",
      "- modelAnswer must be 4~6 Korean lines, realistic, non-exaggerated, and based only on provided evidence.",
      "- Add caution when overstatement risk exists (RAG/Agent/production-scale/internal tools/public 운영 등).",
      "",
      "URL / live service questions:",
      "- Do NOT ask for a live URL, demo link, or portfolio site unless the candidate or project text explicitly mentions deployment, production URL, or public demo.",
      "- If no URL is evidenced, ask about how they validated quality (local/staging, metrics, user test) instead.",
      "",
      "Do not assume RAG/agents/production scale unless explicitly stated in inputs.",
      "Return strict JSON only.",
      "{format_instructions}",
      "Candidate JSON: {candidate}",
      "Job JSON: {job}",
      "Gap analysis JSON (for verification themes; optional): {gap}",
      "Prioritized project context: {prioritized_project_context}"
    ].join("\n")
  );
  const chain = RunnableSequence.from([prompt, llm, parser]);
  const parsed = interviewSchema.parse(
    await chain.invoke({
      format_instructions:
        "Field: items (array of exactly 5 objects: section(core|deep), question, whyAsked, answerPoints(2~4), modelAnswer, caution optional)",
      candidate: JSON.stringify(candidate),
      job: JSON.stringify(job),
      gap: gapAnalysis ? JSON.stringify(gapAnalysis) : "{}",
      prioritized_project_context: prioritizedProjectContext ?? "N/A"
    })
  );
  return parsed.items;
}
