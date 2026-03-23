import { JsonOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { CandidateProfile, JobPostingProfile } from "../workflow.types";

const interviewSchema = z.object({
  questions: z.array(z.string()).min(5).max(12)
});

export async function runInterviewQuestionsChain(
  llm: ChatOpenAI,
  candidate: CandidateProfile,
  job: JobPostingProfile
): Promise<string[]> {
  const parser = new JsonOutputParser<{ questions: string[] }>();
  const prompt = PromptTemplate.fromTemplate(
    [
      "Generate Korean interview questions based on candidate-job fit.",
      "Return strict JSON only.",
      "{format_instructions}",
      "Candidate JSON: {candidate}",
      "Job JSON: {job}"
    ].join("\n")
  );
  const chain = RunnableSequence.from([prompt, llm, parser]);
  const parsed = interviewSchema.parse(
    await chain.invoke({
      format_instructions: "Field: questions (array of 5~12 strings)",
      candidate: JSON.stringify(candidate),
      job: JSON.stringify(job)
    })
  );
  return parsed.questions;
}
