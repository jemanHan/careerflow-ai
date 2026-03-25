import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";
import { CandidateProfile, GapAnalysis, JobPostingProfile } from "../workflow.types";

const gapSchema = z.object({
  matchedSignals: z.array(z.string()),
  missingSignals: z.array(z.string()),
  weakEvidence: z.array(z.string())
});

const NOISE_TOKENS = new Set([
  "채용",
  "채용합니다",
  "지원",
  "모집",
  "주요",
  "업무",
  "자격",
  "요건",
  "우대",
  "사항",
  "경험",
  "필수",
  "직무",
  "역할",
  "및",
  "또는",
  "관련",
  "있음",
  "가능",
  "실제",
  "활용해",
  "통해",
  "중심",
  "기반"
]);

function stripKoreanParticle(value: string): string {
  return value.replace(/(를|을|이|가|은|는|에|의|와|과|로|으로|도|만|까지)$/g, "");
}

function isMeaningfulSignal(value: string): boolean {
  const cleaned = stripKoreanParticle(value.toLowerCase().trim());
  if (cleaned.length < 2) return false;
  if (NOISE_TOKENS.has(cleaned)) return false;
  if (/^\d+$/.test(cleaned)) return false;
  return true;
}

function normalizeGapItems(items: string[], limit: number) {
  return items
    .map((item) => item.replace(/\s+/g, " ").trim())
    .map((item) => stripKoreanParticle(item))
    .filter((item) => item.length > 0)
    .filter((item) => isMeaningfulSignal(item))
    .filter((item, idx, arr) => arr.indexOf(item) === idx)
    .slice(0, limit);
}

function getMessageContentText(message: unknown): string {
  if (typeof message === "string") return message;
  if (!message || typeof message !== "object") return "";
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text: string }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return String(content ?? "");
}

/**
 * Gemini 등이 마크다운·후행 쉼표·주변 잡문으로 JSON을 깨뜨릴 때 JsonOutputParser보다 복구율이 높음.
 */
function parseLenientGapJson(rawText: string): unknown {
  let s = rawText.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    s = fence[1].trim();
  }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("gap_json_no_object");
  }
  s = s.slice(start, end + 1);
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");
  s = s.replace(/,\s*([\]}])/g, "$1");
  return JSON.parse(s);
}

export async function runGapDetectionChain(
  llm: BaseChatModel,
  candidate: CandidateProfile,
  job: JobPostingProfile
): Promise<GapAnalysis> {
  const prompt = PromptTemplate.fromTemplate(
    [
      "You compare structured candidate evidence vs structured job posting requirement signals.",
      "This product is role-agnostic (PM, design, data, marketing, ops, research, QA, support, engineering, etc.).",
      "Do NOT assume software engineering. Do NOT use hidden role buckets (frontend/backend/fullstack).",
      "Do NOT use demo labels or template names as signals.",
      "",
      "Output JSON fields in Korean: matchedSignals, missingSignals, weakEvidence.",
      "Each array item: ONE human-readable phrase (not a token fragment). Prefer Korean; if the JD is English, still phrase in Korean for end users.",
      "",
      "Definitions (mutually exclusive between missingSignals and weakEvidence):",
      "- matchedSignals: JD asks for it AND candidate has clear supporting evidence (role, deliverable, outcome, tool, metric, or artifact).",
      "- missingSignals: JD clearly requires it AND candidate text has no meaningful supporting evidence (no related project, responsibility, outcome, or artifact).",
      "- weakEvidence: Candidate mentions something related to a JD requirement BUT proof is vague, partial, indirect, or low-specificity (buzzword-only counts as weak, not matched).",
      "",
      "Hard rules:",
      "- The same semantic requirement must NOT appear in both missingSignals and weakEvidence.",
      "- If there is zero support, use missingSignals only. If there is some mention but weak proof, use weakEvidence only.",
      "- Merge near-duplicates inside each array.",
      "- Prefer 4-10 high-quality distinct items per array over noisy repetition.",
      "- No placeholders like '직무' or '경험' alone.",
      "Return up to 10 items per field.",
      "Return ONE raw JSON object only (no markdown fences, no commentary). Escape quotes inside strings.",
      "Candidate JSON: {candidate}",
      "Job JSON: {job}"
    ].join("\n")
  );
  const chain = RunnableSequence.from([prompt, llm]);
  const message = await chain.invoke({
    candidate: JSON.stringify(candidate),
    job: JSON.stringify(job)
  });
  const parsed = gapSchema.parse(parseLenientGapJson(getMessageContentText(message)));
  return {
    matchedSignals: normalizeGapItems(parsed.matchedSignals, 10),
    missingSignals: normalizeGapItems(parsed.missingSignals, 10),
    weakEvidence: normalizeGapItems(parsed.weakEvidence, 10)
  };
}
