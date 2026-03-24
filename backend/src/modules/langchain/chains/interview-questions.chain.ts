import { JsonOutputParser } from "@langchain/core/output_parsers";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";
import { CandidateProfile, JobPostingProfile } from "../workflow.types";

const interviewSchema = z.object({
  questions: z.array(z.string()).min(5).max(12)
});

export async function runInterviewQuestionsChain(
  llm: BaseChatModel,
  candidate: CandidateProfile,
  job: JobPostingProfile,
  prioritizedProjectContext?: string
): Promise<string[]> {
  const parser = new JsonOutputParser<{ questions: string[] }>();
  const prompt = PromptTemplate.fromTemplate(
    [
      "Generate Korean interview questions based on candidate-job fit.",
      "Ground every question in provided evidence only.",
      "Do not assume direct RAG/agent implementation unless explicitly described in the input.",
      "Prioritize verification questions for weak or missing evidence.",
      "Prioritize questions that validate the highlighted project context if provided.",
      "Return strict JSON only.",
      "{format_instructions}",
      "Candidate JSON: {candidate}",
      "Job JSON: {job}",
      "Prioritized project context: {prioritized_project_context}"
    ].join("\n")
  );
  const chain = RunnableSequence.from([prompt, llm, parser]);
  const parsed = interviewSchema.parse(
    await chain.invoke({
      format_instructions: "Field: questions (array of 5~12 strings)",
      candidate: JSON.stringify(candidate),
      job: JSON.stringify(job),
      prioritized_project_context: prioritizedProjectContext ?? "N/A"
    })
  );
  return parsed.questions;
}
