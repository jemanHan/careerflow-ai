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
  gapAnalysis: GapAnalysis
): Promise<string[]> {
  const parser = new JsonOutputParser<{ questions: string[] }>();
  const prompt = PromptTemplate.fromTemplate(
    [
      "Generate 1 to 3 Korean prompts for LIGHT resume/application follow-up (NOT interview depth).",
      "User will answer in one short paragraph or a few lines — no essays, no portfolio URLs required.",
      "",
      "Rules:",
      "- Exactly 1 to 3 items in `questions` array.",
      "- Each question: ONE short sentence only (under ~80 Korean characters).",
      "- Friendly, concrete: ask for one fact, keyword, or role line — not 'explain TypeScript in production' or 'list live service URLs'.",
      "- Tie loosely to missingSignals / weakEvidence themes but keep wording easy to answer in 30 seconds.",
      "- No numbering prefix like Q1., 질문1.",
      "",
      "Return strict JSON only.",
      "{format_instructions}",
      "Gap JSON: {gap}"
    ].join("\n")
  );
  const chain = RunnableSequence.from([prompt, llm, parser]);
  const parsed = rawShape.parse(
    await chain.invoke({
      format_instructions:
        "Field: questions (array of 1 to 3 short Korean strings, one sentence each)",
      gap: JSON.stringify(gapAnalysis)
    })
  );
  const trimmed = parsed.questions
    .map((q) => q.trim())
    .filter((q) => q.length > 0)
    .slice(0, 3);
  if (trimmed.length === 0) {
    throw new Error("follow_up_questions_empty");
  }
  return trimmed;
}
