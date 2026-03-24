import { JsonOutputParser } from "@langchain/core/output_parsers";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";
import { CandidateProfile, GapAnalysis, JobPostingProfile } from "../workflow.types";

const gapSchema = z.object({
  matchedSignals: z.array(z.string()),
  missingSignals: z.array(z.string()),
  weakEvidence: z.array(z.string())
});

export async function runGapDetectionChain(
  llm: BaseChatModel,
  candidate: CandidateProfile,
  job: JobPostingProfile
): Promise<GapAnalysis> {
  const parser = new JsonOutputParser<GapAnalysis>();
  const prompt = PromptTemplate.fromTemplate(
    [
      "You compare candidate profile and target job requirements.",
      "Write matchedSignals, missingSignals, weakEvidence in plain Korean phrases.",
      "Avoid raw buzzwords-only output like 'RAG', 'Agent' without explanation.",
      "Return strict JSON only.",
      "{format_instructions}",
      "Candidate JSON: {candidate}",
      "Job JSON: {job}"
    ].join("\n")
  );
  const chain = RunnableSequence.from([prompt, llm, parser]);
  return gapSchema.parse(
    await chain.invoke({
      format_instructions: "Fields: matchedSignals, missingSignals, weakEvidence",
      candidate: JSON.stringify(candidate),
      job: JSON.stringify(job)
    })
  );
}
