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

const HANGUL = /[가-힣]/g;

function hangulRatio(text: string): number {
  const t = text.replace(/\s/g, "");
  if (t.length === 0) return 0;
  const m = t.match(HANGUL);
  return (m?.length ?? 0) / t.length;
}

/** UI 특화 포인트: 한 줄·짧게, 한국어 중심(영어 장문 요약 제외) */
function sanitizeStrengthLine(s: string, maxLen: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (hangulRatio(t) < 0.12 && t.length > 28) return "";
  return t.length <= maxLen ? t : t.slice(0, maxLen).replace(/\s+\S*$/, "").trim();
}

/** 짧은 명사형·근거형으로 다듬기(원문 LLM 요약체 완화) */
function polishSpecialtyLineKorean(s: string): string {
  let t = s.replace(/\s+/g, " ").trim();
  t = t.replace(/\s*(입니다|합니다|함|예요|이에요)\s*$/g, "");
  t = t.replace(/^[\s\-•·]+/, "");
  return t.trim();
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

  const cap = 6;
  const maxLine = 52;
  const pick =
    merged.length > 0
      ? merged
      : uniqueStrings(fromStrengths);

  let lines = pick
    .map((s) => polishSpecialtyLineKorean(sanitizeStrengthLine(s, maxLine)))
    .filter((s) => s.length > 0)
    .slice(0, cap);

  if (lines.length === 0 && pick.length > 0) {
    lines = pick.slice(0, cap).map((s) => {
      const t = polishSpecialtyLineKorean(s.replace(/\s+/g, " ").trim());
      return t.length <= maxLine ? t : t.slice(0, maxLine).replace(/\s+\S*$/, "").trim();
    });
  }

  return lines;
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
      "Natural-language fields (summary, strengths[], experiences.impact, project descriptions/evidence) MUST be written in Korean (한국어).",
      "Each strengths[] item must be one short phrase (roughly under 52 characters), evidence-style, not a long paragraph.",
      "Use natural Korean noun-phrase style (명사형·짧은 구), e.g. 'LMS·여행 플랫폼 웹서비스 풀스택 구현', not formal speech endings.",
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
