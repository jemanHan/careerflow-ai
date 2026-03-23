import { JsonOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { GapAnalysis } from "../workflow.types";

const followUpSchema = z.object({
  questions: z.array(z.string()).min(3).max(7)
});

export async function runFollowUpQuestionsChain(
  llm: ChatOpenAI,
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
      format_instructions: "Field: questions (array of 3~7 strings)",
      gap: JSON.stringify(gapAnalysis)
    })
  );
  return result.questions;
}
