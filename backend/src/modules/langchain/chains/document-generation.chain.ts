import { JsonOutputParser } from "@langchain/core/output_parsers";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";
import { CandidateProfile, GeneratedDraft, JobPostingProfile } from "../workflow.types";

const draftSchema = z.object({
  coverLetter: z.string(),
  careerDescription: z.string(),
  projectIntro: z.string()
});

export async function runDocumentGenerationChain(
  llm: BaseChatModel,
  candidate: CandidateProfile,
  job: JobPostingProfile,
  prioritizedProjectContext?: string
): Promise<GeneratedDraft> {
  const parser = new JsonOutputParser<GeneratedDraft>();
  const prompt = PromptTemplate.fromTemplate(
    [
      "Generate practical Korean drafts for a job application workflow tool.",
      "Use only evidence explicitly present in candidate/job/project input.",
      "Do not overclaim unverified experiences (especially RAG, autonomous agent systems, production metrics).",
      "When evidence is weak, use cautious wording like '구현/검증 중', '초기 버전'.",
      "Treat outputs as draft texts, not final submitted statements.",
      "Use prioritized project context as the first reference for project-related narrative.",
      "careerDescription must act like a 'career-description helper' with this structure:",
      "1) 간단 자기소개(3~4문장)",
      "2) 공고 요구조건과 겹치는 경험(불릿)",
      "3) 보완 필요 항목(불릿, 실천 제안 포함)",
      "projectIntro should provide concise project evidence bullets that can be appended to careerDescription.",
      "Return strict JSON only.",
      "{format_instructions}",
      "Candidate JSON: {candidate}",
      "Job JSON: {job}",
      "Prioritized project context: {prioritized_project_context}"
    ].join("\n")
  );
  const chain = RunnableSequence.from([prompt, llm, parser]);
  return draftSchema.parse(
    await chain.invoke({
      format_instructions: "Fields: coverLetter, careerDescription, projectIntro",
      candidate: JSON.stringify(candidate),
      job: JSON.stringify(job),
      prioritized_project_context: prioritizedProjectContext ?? "N/A"
    })
  );
}
