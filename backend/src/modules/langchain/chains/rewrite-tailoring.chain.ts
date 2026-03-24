import { JsonOutputParser } from "@langchain/core/output_parsers";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";
import { GeneratedDraft, JobPostingProfile, RewriteDraft } from "../workflow.types";

const rewriteSchema = z.object({
  coverLetter: z.string(),
  careerDescription: z.string(),
  projectIntro: z.string()
});

export async function runRewriteTailoringChain(
  llm: BaseChatModel,
  draft: GeneratedDraft,
  job: JobPostingProfile,
  prioritizedProjectContext?: string
): Promise<RewriteDraft> {
  const parser = new JsonOutputParser<RewriteDraft>();
  const prompt = PromptTemplate.fromTemplate(
    [
      "Rewrite each draft to better fit the target job posting while keeping factual consistency.",
      "When provided, preserve and emphasize prioritized project context.",
      "Return strict JSON only.",
      "{format_instructions}",
      "Draft JSON: {draft}",
      "Job JSON: {job}",
      "Prioritized project context: {prioritized_project_context}"
    ].join("\n")
  );
  const chain = RunnableSequence.from([prompt, llm, parser]);
  return rewriteSchema.parse(
    await chain.invoke({
      format_instructions: "Fields: coverLetter, careerDescription, projectIntro",
      draft: JSON.stringify(draft),
      job: JSON.stringify(job),
      prioritized_project_context: prioritizedProjectContext ?? "N/A"
    })
  );
}
