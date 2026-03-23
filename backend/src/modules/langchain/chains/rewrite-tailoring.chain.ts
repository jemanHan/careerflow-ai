import { JsonOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { GeneratedDraft, JobPostingProfile, RewriteDraft } from "../workflow.types";

const rewriteSchema = z.object({
  coverLetter: z.string(),
  careerDescription: z.string(),
  projectIntro: z.string()
});

export async function runRewriteTailoringChain(
  llm: ChatOpenAI,
  draft: GeneratedDraft,
  job: JobPostingProfile
): Promise<RewriteDraft> {
  const parser = new JsonOutputParser<RewriteDraft>();
  const prompt = PromptTemplate.fromTemplate(
    [
      "Rewrite each draft to better fit the target job posting while keeping factual consistency.",
      "Return strict JSON only.",
      "{format_instructions}",
      "Draft JSON: {draft}",
      "Job JSON: {job}"
    ].join("\n")
  );
  const chain = RunnableSequence.from([prompt, llm, parser]);
  return rewriteSchema.parse(
    await chain.invoke({
      format_instructions: "Fields: coverLetter, careerDescription, projectIntro",
      draft: JSON.stringify(draft),
      job: JSON.stringify(job)
    })
  );
}
