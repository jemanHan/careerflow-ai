import { JsonOutputParser } from "@langchain/core/output_parsers";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";
import { CandidateProfile, GeneratedDraft, JobPostingProfile } from "../workflow.types";

function normalizeDraftText(value: unknown): string {
  function toLines(input: unknown, depth = 0): string[] {
    if (input == null) return [];
    if (typeof input === "string") {
      const trimmed = input.trim();
      if (!trimmed) return [];
      if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
        try {
          return toLines(JSON.parse(trimmed), depth);
        } catch {
          return [trimmed];
        }
      }
      const jsonStart = Math.min(
        ...["{", "["]
          .map((token) => trimmed.indexOf(token))
          .filter((idx) => idx >= 0)
      );
      if (Number.isFinite(jsonStart) && jsonStart > 0) {
        const prefix = trimmed.slice(0, jsonStart).trim();
        const jsonPart = trimmed.slice(jsonStart);
        try {
          const parsedLines = toLines(JSON.parse(jsonPart), depth);
          return prefix ? [prefix, ...parsedLines] : parsedLines;
        } catch {
          return [trimmed];
        }
      }
      return [trimmed];
    }
    if (Array.isArray(input)) {
      return input.flatMap((item) => {
        const itemLines = toLines(item, depth + 1);
        if (itemLines.length === 0) return [];
        const [first, ...rest] = itemLines;
        return [`- ${first}`, ...rest.map((line) => `  ${line}`)];
      });
    }
    if (typeof input === "object") {
      const obj = input as Record<string, unknown>;
      const maybeText = obj.text;
      if (typeof maybeText === "string" && maybeText.trim()) return [maybeText.trim()];
      const lines: string[] = [];
      for (const [key, val] of Object.entries(obj)) {
        const child = toLines(val, depth + 1);
        if (child.length === 0) continue;
        const title = depth === 0 ? key : `- ${key}`;
        lines.push(title);
        lines.push(...child.map((line) => (depth === 0 ? `- ${line}` : `  ${line}`)));
      }
      return lines;
    }
    return [String(input)];
  }

  return toLines(value).join("\n").trim();
}

const draftSchema = z.object({
  coverLetter: z.unknown().transform(normalizeDraftText),
  careerDescription: z.unknown().transform(normalizeDraftText),
  projectIntro: z.unknown().transform(normalizeDraftText)
});

export async function runDocumentGenerationChain(
  llm: BaseChatModel,
  candidate: CandidateProfile,
  job: JobPostingProfile,
  prioritizedProjectContext?: string
): Promise<GeneratedDraft> {
  const parser = new JsonOutputParser<GeneratedDraft>();
  const prompt = PromptTemplate.fromTemplate(
    [
      "Generate practical Korean drafts for a job application workflow tool.",
      "Use only evidence explicitly present in candidate/job/project input.",
      "Do not overclaim unverified experiences (especially RAG, autonomous agent systems, production metrics).",
      "When evidence is weak, use cautious wording like '구현/검증 중', '초기 버전'.",
      "Treat outputs as draft texts, not final submitted statements.",
      "Use prioritized project context as the first reference for project-related narrative.",
      "Career description quality rules:",
      "- Keep statements concise and scannable; prefer short bullet-oriented phrasing.",
      "- Prioritize experiences matching target JD requirements first.",
      "- Include only skills/tech actually used by the candidate (no speculative listing).",
      "- For each key experience, state role + tech + result/effect when evidence exists.",
      "- Never invent achievements or tools not grounded in input evidence.",
      "careerDescription must act like a 'career-description helper' with this structure:",
      "1) 간단 자기소개(3~4문장)",
      "2) 공고 요구조건과 겹치는 경험(불릿)",
      "3) 보완 필요 항목(불릿, 실천 제안 포함)",
      "projectIntro should provide concise project evidence bullets that can be appended to careerDescription.",
      "Return strict JSON only.",
      "{format_instructions}",
      "Candidate JSON: {candidate}",
      "Job JSON: {job}",
      "Prioritized project context: {prioritized_project_context}"
    ].join("\n")
  );
  const chain = RunnableSequence.from([prompt, llm, parser]);
  return draftSchema.parse(
    await chain.invoke({
      format_instructions: "Fields: coverLetter, careerDescription, projectIntro",
      candidate: JSON.stringify(candidate),
      job: JSON.stringify(job),
      prioritized_project_context: prioritizedProjectContext ?? "N/A"
    })
  );
}
