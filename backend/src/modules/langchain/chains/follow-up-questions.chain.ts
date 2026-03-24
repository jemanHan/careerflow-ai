import { JsonOutputParser } from "@langchain/core/output_parsers";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";
import { GapAnalysis } from "../workflow.types";

const followUpSchema = z.object({
  questions: z.array(z.string()).length(5)
});

export async function runFollowUpQuestionsChain(
  llm: BaseChatModel,
  gapAnalysis: GapAnalysis
): Promise<string[]> {
  const parser = new JsonOutputParser<{ questions: string[] }>();
  const prompt = PromptTemplate.fromTemplate(
    [
      "Generate concise Korean follow-up questions for missing evidence.",
      "Return strict JSON only.",
      "{format_instructions}",
      "Gap JSON: {gap}"
    ].join("\n")
  );
  const chain = RunnableSequence.from([prompt, llm, parser]);
  const result = followUpSchema.parse(
    await chain.invoke({
      format_instructions: "Field: questions (array of exactly 5 strings)",
      gap: JSON.stringify(gapAnalysis)
    })
  );
  return result.questions;
}
