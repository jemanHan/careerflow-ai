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

const GENERIC_STRENGTHS = new Set(["문제 해결", "협업", "실행", "커뮤니케이션", "책임감", "성실함"]);

function uniqueStrings(values: string[]): string[] {
  return values
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .filter((v, i, arr) => arr.indexOf(v) === i);
}

function enrichStrengths(raw: CandidateProfile): string[] {
  const fromStrengths = raw.strengths ?? [];
  const fromTech = (raw.experiences ?? []).flatMap((exp) => exp.techStack ?? []);
  const fromProjectEvidence = (raw.projects ?? []).flatMap((p) => p.evidence ?? []);
  const concreteCandidates = uniqueStrings([...fromTech, ...fromProjectEvidence]).filter(
    (v) => v.length >= 3 && v.length <= 40
  );

  const nonGenericStrengths = fromStrengths.filter((v) => !GENERIC_STRENGTHS.has(v));
  const merged = uniqueStrings([...nonGenericStrengths, ...concreteCandidates]);

  // 강점이 전부 일반론으로 붕괴되는 경우 concrete 신호를 우선 노출
  if (merged.length > 0) return merged.slice(0, 8);
  return uniqueStrings(fromStrengths).slice(0, 6);
}

export async function runCandidateProfileChain(
  llm: BaseChatModel,
  sourceText: string,
  prioritizedProjectContext?: string
): Promise<CandidateProfile> {
  const parser = new JsonOutputParser<CandidateProfile>();
  const prompt = PromptTemplate.fromTemplate(
    [
      "You are a parser for a hiring workflow product.",
      "Extract candidate evidence signals from resume, portfolio and project text.",
      "Do not assume software-only jobs; keep wording role-agnostic.",
      "Preserve concrete evidence such as tools, technologies, methods, deliverables, and project names.",
      "Do not collapse strengths into generic soft skills only.",
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
    strengths: enrichStrengths({
      ...raw,
      projects: raw.projects.map((project) => ({
        ...project,
        evidence: Array.isArray(project.evidence) ? project.evidence : [project.evidence]
      }))
    }),
    projects: raw.projects.map((project) => ({
      ...project,
      evidence: Array.isArray(project.evidence) ? project.evidence : [project.evidence]
    }))
  };
  return candidateSchema.parse(normalized);
}
