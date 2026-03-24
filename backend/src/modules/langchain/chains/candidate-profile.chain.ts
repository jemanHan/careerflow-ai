import { JsonOutputParser } from "@langchain/core/output_parsers";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
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

const candidateFlexibleSchema = z.object({
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
      evidence: z.union([z.array(z.string()), z.string()])
    })
  )
});

export async function runCandidateProfileChain(
  llm: BaseChatModel,
  sourceText: string,
  prioritizedProjectContext?: string
): Promise<CandidateProfile> {
  const parser = new JsonOutputParser<CandidateProfile>();
  const prompt = PromptTemplate.fromTemplate(
    [
      "You are a parser for a hiring workflow product.",
      "Extract candidate profile from resume, portfolio and project text.",
      "If prioritized project context exists, treat it as primary project evidence.",
      "Return strict JSON only.",
      "{format_instructions}",
      "Prioritized project context:",
      "{prioritized_project_context}",
      "Input text:",
      "{input}"
    ].join("\n")
  );

  const chain = RunnableSequence.from([prompt, llm, parser]);
  const raw = candidateFlexibleSchema.parse(
    await chain.invoke({
      input: sourceText,
      prioritized_project_context: prioritizedProjectContext ?? "N/A",
      format_instructions: "Fields: summary, strengths, experiences[{title,impact,techStack}], projects[{name,description,evidence}]"
    })
  );

  const normalized: CandidateProfile = {
    ...raw,
    projects: raw.projects.map((project) => ({
      ...project,
      evidence: Array.isArray(project.evidence) ? project.evidence : [project.evidence]
    }))
  };
  return candidateSchema.parse(normalized);
}
