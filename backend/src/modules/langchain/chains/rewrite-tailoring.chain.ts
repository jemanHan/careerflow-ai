import { JsonOutputParser } from "@langchain/core/output_parsers";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";
import { GeneratedDraft, JobPostingProfile, RewriteDraft } from "../workflow.types";

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

const rewriteSchema = z.object({
  coverLetter: z.unknown().transform(normalizeDraftText),
  careerDescription: z.unknown().transform(normalizeDraftText)
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
      "Rewrite quality rules:",
      "- Keep wording concise and interview-scannable (short sentences, practical bullets where appropriate).",
      "- Reorder content so JD-relevant experience appears first.",
      "- Do not add technologies or responsibilities that are not explicitly evidenced.",
      "- Maintain an honest tone when evidence is limited.",
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
      format_instructions: "Fields: coverLetter, careerDescription",
      draft: JSON.stringify(draft),
      job: JSON.stringify(job),
      prioritized_project_context: prioritizedProjectContext ?? "N/A"
    })
  );
}
