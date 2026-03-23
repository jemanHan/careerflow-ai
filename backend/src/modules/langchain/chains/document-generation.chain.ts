import { JsonOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { CandidateProfile, GeneratedDraft, JobPostingProfile } from "../workflow.types";

const draftSchema = z.object({
  coverLetter: z.string(),
  careerDescription: z.string(),
  projectIntro: z.string()
});

export async function runDocumentGenerationChain(
  llm: ChatOpenAI,
  candidate: CandidateProfile,
  job: JobPostingProfile
): Promise<GeneratedDraft> {
  const parser = new JsonOutputParser<GeneratedDraft>();
  const prompt = PromptTemplate.fromTemplate(
    [
      "Generate practical Korean drafts for a job application workflow tool.",
      "Return strict JSON only.",
      "{format_instructions}",
      "Candidate JSON: {candidate}",
      "Job JSON: {job}"
    ].join("\n")
  );
  const chain = RunnableSequence.from([prompt, llm, parser]);
  return draftSchema.parse(
    await chain.invoke({
      format_instructions: "Fields: coverLetter, careerDescription, projectIntro",
      candidate: JSON.stringify(candidate),
      job: JSON.stringify(job)
    })
  );
}
