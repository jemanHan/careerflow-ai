import { JsonOutputParser } from "@langchain/core/output_parsers";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";
import { GapAnalysis } from "../workflow.types";

const rawShape = z.object({
  questions: z.array(z.string())
});

export async function runFollowUpQuestionsChain(
  llm: BaseChatModel,
  gapAnalysis: GapAnalysis,
  targetCount: number
): Promise<string[]> {
  const n = Math.max(1, Math.min(15, Math.floor(targetCount)));
  const parser = new JsonOutputParser<{ questions: string[] }>();
  const prompt = PromptTemplate.fromTemplate(
    [
      "Generate exactly {targetCount} Korean follow-up prompts for resume/application evidence collection (NOT a job interview).",
      "The product serves ANY job type (product, design, data, operations, PM, marketing, research, QA, support, engineering, etc.).",
      "Do NOT assume the candidate already has experience that appears in missingSignals.",
      "",
      "Each question MUST be conditional evidence-validation:",
      "- Start from whether they have direct experience, OR ask for clarification without assuming they did it.",
      "- Use the pattern: if experience may be absent, include both branches: \"있으면 … 없으면 …\" (brief).",
      "- If the theme is in weakEvidence (not missing), ask for stronger proof: role, scope, metric, outcome, validation, artifact — without claiming they lack all experience.",
      "",
      "Forbidden:",
      "- Questions that assume they implemented/built something (e.g. \"When you implemented RAG…\", \"What issue did you face building the agent?\").",
      "- Duplicate questions for semantically overlapping gap themes.",
      "- Generic filler (\"열정\", \"자기소개\") unrelated to gap themes.",
      "- Numbering prefixes (Q1., 질문1.).",
      "",
      "Rules:",
      "- Exactly {targetCount} items in `questions` (no fewer, no more).",
      "- Each item: 1-2 short sentences, under ~240 Korean characters total per item.",
      "- missingSignals / weakEvidence are Korean user-facing labels; assign one distinct gap theme per question where possible.",
      "- Cover ALL missingSignals themes first (one question per item, in order of importance), then weakEvidence until you reach {targetCount}.",
      "- Tie wording to those themes but stay fair and conditional.",
      "",
      "Return strict JSON only.",
      "{format_instructions}",
      "Gap JSON: {gap}"
    ].join("\n")
  );
  const chain = RunnableSequence.from([prompt, llm, parser]);
  const parsed = rawShape.parse(
    await chain.invoke({
      targetCount: String(n),
      format_instructions: `Field: questions (array of exactly ${n} Korean strings, conditional evidence-validation style)`,
      gap: JSON.stringify(gapAnalysis)
    })
  );
  const trimmed = parsed.questions
    .map((q) => q.trim())
    .filter((q) => q.length > 0)
    .slice(0, n);
  if (trimmed.length === 0) {
    throw new Error("follow_up_questions_empty");
  }
  return trimmed;
}
