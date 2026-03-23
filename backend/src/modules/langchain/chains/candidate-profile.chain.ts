import { JsonOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { CandidateProfile } from "../workflow.types";

const candidateSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  experiences: z.array(
    z.object({
      title: z.string(),
      impact: z.string(),
      techStack: z.array(z.string())
    })
  ),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      evidence: z.array(z.string())
    })
  )
});

export async function runCandidateProfileChain(llm: ChatOpenAI, sourceText: string): Promise<CandidateProfile> {
  const parser = new JsonOutputParser<CandidateProfile>();
  const prompt = PromptTemplate.fromTemplate(
    [
      "You are a parser for a hiring workflow product.",
      "Extract candidate profile from resume, portfolio and project text.",
      "Return strict JSON only.",
      "{format_instructions}",
      "Input text:",
      "{input}"
    ].join("\n")
  );

  const chain = RunnableSequence.from([prompt, llm, parser]);
  return candidateSchema.parse(
    await chain.invoke({
      input: sourceText,
      format_instructions: "Fields: summary, strengths, experiences[{title,impact,techStack}], projects[{name,description,evidence}]"
    })
  );
}
