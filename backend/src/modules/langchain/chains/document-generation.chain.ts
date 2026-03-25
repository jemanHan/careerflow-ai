import { JsonOutputParser } from "@langchain/core/output_parsers";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";
import { CandidateProfile, GeneratedDraft, JobPostingProfile } from "../workflow.types";

function normalizeDraftText(value: unknown): string {
  function cleanupLines(lines: string[]): string[] {
    return lines
      .map((line) => line.replace(/^\s*(?:-\s*){2,}/, "- ").replace(/\s+$/g, ""))
      .filter((line, idx, arr) => !(line.trim() === "" && arr[idx - 1]?.trim() === ""));
  }

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

  return cleanupLines(toLines(value)).join("\n").trim();
}

const draftSchema = z.object({
  coverLetter: z.unknown().transform(normalizeDraftText),
  careerDescription: z.unknown().transform(normalizeDraftText)
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
      "Tone safety: avoid strong self-evaluative adjectives such as '능숙', '전문가', '탁월'. Prefer safer wording like '활용 경험이 있습니다', '설계·적용 경험이 있습니다', '수행 경험이 있습니다'.",
      "Do NOT include reflective sections like '배운 점', '회고', '느낀 점' in final drafts. Keep it professional and job-application-ready.",
      "Treat outputs as draft texts, not final submitted statements.",
      "Use prioritized project context as the first reference for project-related narrative.",
      "Career description quality rules:",
      "- Write like a portfolio-ready summary, not a full resume dump.",
      "- Use only evidence present in candidate/job input. Do not infer unseen companies/metrics/tech.",
      "- Prioritize shared core elements across roles: 경력(역할/기간), 핵심 활동, 프로젝트 결과.",
      "- Include only top 3~6 most relevant experiences; avoid exhaustive skill/tool listing.",
      "- Each bullet should be 1~2 practical sentences (role + action + effect).",
      "- Remove duplicated bullets and nested bullet artifacts such as '- -'.",
      "- Do not introduce new domains/buzzwords that are not explicitly present in input (example: 'RAG', 'Agent', '멀티모달', '자율 에이전트').",
      "- '보완 필요 항목'은 입력에서 확인되는 '근거가 부족한 지점(예: 수치/성과/의사결정 근거의 디테일)'을 정리하는 방식으로만 제안하고, 새로운 기술 도입을 주장하지 마세요.",
      "careerDescription must follow this section order:",
      "1) 간단 자기소개 (2~4문장)",
      "2) 공고 요구조건과 겹치는 경험 (3~6개 불릿)",
      "3) 보완 필요 항목 (1~3개 불릿, 현실적인 개선 제안)",
      "Never expose internal structure markers like '[프로젝트 근거 정리]', 'name', 'bullets', JSON keys, or debugging text in final output.",
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
      format_instructions: "Fields: coverLetter, careerDescription",
      candidate: JSON.stringify(candidate),
      job: JSON.stringify(job),
      prioritized_project_context: prioritizedProjectContext ?? "N/A"
    })
  );
}
