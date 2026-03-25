import { JsonOutputParser } from "@langchain/core/output_parsers";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";
import { JobPostingProfile } from "../workflow.types";

const jobSchema = z.object({
  role: z.string(),
  summary: z.string().optional(),
  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()),
  responsibilities: z.array(z.string()),
  evaluationSignals: z.array(z.string()),
  domainSignals: z.array(z.string()).optional(),
  collaborationSignals: z.array(z.string()).optional(),
  toolSignals: z.array(z.string()).optional(),
  senioritySignals: z.array(z.string()).optional(),
  outputExpectations: z.array(z.string()).optional()
});

export async function runJobPostingChain(llm: BaseChatModel, jobText: string): Promise<JobPostingProfile> {
  const parser = new JsonOutputParser<JobPostingProfile>();
  const prompt = PromptTemplate.fromTemplate(
    [
      "You analyze job postings for signal-matching hiring workflows.",
      "Do not classify into fixed role buckets.",
      "Extract requirement/evaluation signals directly from the text.",
      "Keep each signal short and concrete.",
      "Return strict JSON only.",
      "{format_instructions}",
      "Job posting text:",
      "{input}"
    ].join("\n")
  );
  const chain = RunnableSequence.from([prompt, llm, parser]);
  return jobSchema.parse(
    await chain.invoke({
      input: jobText,
      format_instructions:
        "Fields: role, summary, requiredSkills, preferredSkills, responsibilities, evaluationSignals, domainSignals, collaborationSignals, toolSignals, senioritySignals, outputExpectations"
    })
  );
}
