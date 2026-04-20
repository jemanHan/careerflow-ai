import { Logger } from "@nestjs/common";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AIMessage } from "@langchain/core/messages";
import { z } from "zod";
import {
  AI_FEED_MAX_ITEM_AGE_DAYS,
  AI_FEED_MAX_ITEMS_PER_SOURCE,
  AI_FEED_RESULT_LIMIT,
  aiFeedSources,
  llmNewsKeywords,
  modelKeywordGroups,
  strongLlmTitleKeywords,
  topicKeywordGroups
} from "./ai-feed.constants";
import { AiFeedItem, AiFeedSnapshot, AiFeedSource, AiFeedSummary, RawAiFeedItem } from "./ai-feed.types";

const summarySchema = z.object({
  titleKo: z.string().min(1),
  summaryKo: z.string().min(1),
  whyItMatters: z.string().min(1),
  bullets: z.array(z.string()).max(3).default([])
});

type FeedEntry = {
  title: string;
  link: string;
  publishedAt: string;
  excerpt: string;
};

type CollectorOptions = {
  geminiApiKey?: string;
  geminiModel?: string;
};

export class AiFeedCollector {
  private readonly logger = new Logger(AiFeedCollector.name);
  private readonly geminiApiKey?: string;
  private readonly geminiModel: string;

  constructor(options: CollectorOptions = {}) {
    this.geminiApiKey = options.geminiApiKey?.trim() || undefined;
    this.geminiModel = options.geminiModel?.trim() || "gemini-2.5-flash-lite";
  }

  async collectSnapshot(): Promise<AiFeedSnapshot> {
    const fetchedItems = await this.fetchSourceItems();
    const shortlisted = this.shortlistItems(fetchedItems);
    const summaries = await this.summarizeItems(shortlisted);
    const summaryMap = new Map(summaries.map((item) => [item.id, item]));

    const items: AiFeedItem[] = shortlisted.map((item) => {
      const summary = summaryMap.get(item.id);
      return {
        id: item.id,
        source: item.source,
        sourceUrl: item.sourceUrl,
        link: item.link,
        publishedAt: item.publishedAt,
        title: item.title,
        titleKo: summary?.titleKo ?? item.title,
        summaryKo: summary?.summaryKo ?? this.buildFallbackSummary(item),
        whyItMatters: summary?.whyItMatters ?? `${item.source}에서 다룬 AI 관련 업데이트입니다.`,
        bullets: summary?.bullets?.length ? summary.bullets : item.tags.slice(0, 3),
        tags: item.tags.length ? item.tags : ["AI"],
        excerpt: item.excerpt
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      itemCount: items.length,
      sources: Array.from(new Set(items.map((item) => item.source))),
      items
    };
  }

  private async fetchSourceItems(): Promise<RawAiFeedItem[]> {
    const settled = await Promise.allSettled(
      aiFeedSources.map(async (source) => {
        const xml = await this.fetchRssXml(source.rssUrl);
        const entries = this.parseFeedXml(xml);

        return entries.map((entry, index) => {
          const searchText = `${source.label} ${entry.title} ${entry.excerpt}`;
          const tags = this.mergeTags(this.extractTags(searchText), source.seedTags);

          return {
            id: `${source.id}-${index}-${entry.link}`,
            source: source.label,
            sourceUrl: source.homeUrl,
            link: entry.link,
            title: entry.title,
            excerpt: entry.excerpt,
            publishedAt: entry.publishedAt,
            tags,
            score: this.scoreItem(entry.title, entry.excerpt, source.priority),
            titleKey: this.normalizeTitleKey(entry.title)
          };
        });
      })
    );

    return settled.flatMap((result) => {
      if (result.status === "fulfilled") {
        return result.value;
      }

      this.logger.warn(`AI feed source fetch failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
      return [];
    });
  }

  private async fetchRssXml(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "careerflow-ai-feed/1.0"
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`RSS_FETCH_FAILED:${response.status}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseFeedXml(xml: string): FeedEntry[] {
    const itemBlocks = this.matchBlocks(xml, "item");
    if (itemBlocks.length) {
      return itemBlocks
        .map((block) => ({
          title: this.decodeEntities(this.getTagText(block, ["title"])) || "Untitled",
          link: this.getTagText(block, ["link"]).trim(),
          publishedAt: this.getTagText(block, ["pubDate", "published", "updated", "dc:date"]).trim(),
          excerpt: this.normalizeExcerpt(
            this.getTagText(block, ["description", "content:encoded", "content", "summary"])
          )
        }))
        .filter((item) => item.link);
    }

    const entryBlocks = this.matchBlocks(xml, "entry");
    return entryBlocks
      .map((block) => ({
        title: this.decodeEntities(this.getTagText(block, ["title"])) || "Untitled",
        link: this.getAtomLink(block),
        publishedAt: this.getTagText(block, ["published", "updated"]).trim(),
        excerpt: this.normalizeExcerpt(this.getTagText(block, ["summary", "content"]))
      }))
      .filter((item) => item.link);
  }

  private matchBlocks(xml: string, tagName: string): string[] {
    const pattern = new RegExp(`<${tagName}\\b[\\s\\S]*?<\\/${tagName}>`, "gi");
    return xml.match(pattern) ?? [];
  }

  private getTagText(block: string, tagNames: string[]): string {
    for (const tagName of tagNames) {
      const pattern = new RegExp(`<${this.escapeRegExp(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${this.escapeRegExp(tagName)}>`, "i");
      const match = block.match(pattern);
      if (match?.[1]) {
        return this.stripCdata(match[1]).trim();
      }
    }

    return "";
  }

  private getAtomLink(block: string): string {
    const alternate = block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i);
    if (alternate?.[1]) {
      return alternate[1].trim();
    }

    const firstHref = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
    return firstHref?.[1]?.trim() ?? "";
  }

  private normalizeExcerpt(value: string): string {
    return this.stripHtml(this.decodeEntities(value)).slice(0, 900);
  }

  private stripHtml(value: string): string {
    return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  private stripCdata(value: string): string {
    return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1");
  }

  private decodeEntities(value: string): string {
    return value
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'");
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private extractTags(text: string): string[] {
    const lower = text.toLowerCase();
    const tags = new Set<string>();

    modelKeywordGroups.forEach((group) => {
      if (group.keywords.some((keyword) => lower.includes(keyword))) {
        tags.add(group.tag);
      }
    });

    topicKeywordGroups.forEach((group) => {
      if (group.keywords.some((keyword) => lower.includes(keyword))) {
        tags.add(group.tag);
      }
    });

    return Array.from(tags);
  }

  private mergeTags(baseTags: string[], extraTags: string[] = []): string[] {
    return Array.from(new Set([...baseTags, ...extraTags]));
  }

  private normalizeTitleKey(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private isRecentEnough(publishedAt: string): boolean {
    const publishedTime = new Date(publishedAt).getTime();
    const cutoff = Date.now() - AI_FEED_MAX_ITEM_AGE_DAYS * 24 * 60 * 60 * 1000;
    return Number.isFinite(publishedTime) && publishedTime >= cutoff;
  }

  private scoreItem(title: string, excerpt: string, sourcePriority: number): number {
    const titleLower = title.toLowerCase();
    const excerptLower = excerpt.toLowerCase();
    const titleHits = strongLlmTitleKeywords.filter((keyword) => titleLower.includes(keyword)).length;
    const excerptHits = llmNewsKeywords.filter((keyword) => excerptLower.includes(keyword)).length;
    return titleHits * 4 + excerptHits + sourcePriority;
  }

  private isRelevantItem(title: string, excerpt: string, tags: string[]): boolean {
    const titleLower = title.toLowerCase();
    const excerptLower = excerpt.toLowerCase();
    const titleHits = strongLlmTitleKeywords.filter((keyword) => titleLower.includes(keyword)).length;
    const excerptHits = llmNewsKeywords.filter((keyword) => excerptLower.includes(keyword)).length;
    return titleHits >= 1 || (tags.length >= 2 && excerptHits >= 2);
  }

  private shortlistItems(items: RawAiFeedItem[]): RawAiFeedItem[] {
    const uniqueItems = new Map<string, RawAiFeedItem>();

    items
      .filter((item) => this.isRecentEnough(item.publishedAt))
      .filter((item) => this.isRelevantItem(item.title, item.excerpt, item.tags))
      .filter((item) => item.score >= 5)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .forEach((item) => {
        const linkKey = item.link.toLowerCase();
        const titleKey = item.titleKey;

        if (!uniqueItems.has(linkKey) && !uniqueItems.has(titleKey)) {
          uniqueItems.set(linkKey, item);
          uniqueItems.set(titleKey, item);
        }
      });

    const uniqueValues = Array.from(new Set(uniqueItems.values())).sort(
      (a, b) => b.score - a.score || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    return this.pickDiverseItems(uniqueValues, AI_FEED_RESULT_LIMIT);
  }

  private pickDiverseItems(items: RawAiFeedItem[], limit: number): RawAiFeedItem[] {
    const grouped = new Map<string, RawAiFeedItem[]>();

    items.forEach((item) => {
      const bucket = grouped.get(item.source) ?? [];
      bucket.push(item);
      grouped.set(item.source, bucket);
    });

    grouped.forEach((bucket, source) => {
      grouped.set(
        source,
        bucket.sort((a, b) => b.score - a.score || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      );
    });

    const selected: RawAiFeedItem[] = [];
    const sourceCounts = new Map<string, number>();
    let remaining = true;

    while (selected.length < limit && remaining) {
      remaining = false;

      for (const [source, bucket] of grouped.entries()) {
        const currentCount = sourceCounts.get(source) ?? 0;
        const nextItem = bucket.shift();

        if (!nextItem || currentCount >= AI_FEED_MAX_ITEMS_PER_SOURCE) {
          continue;
        }

        selected.push(nextItem);
        sourceCounts.set(source, currentCount + 1);
        remaining = true;

        if (selected.length >= limit) {
          break;
        }
      }
    }

    return selected.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }

  private async summarizeItems(items: RawAiFeedItem[]): Promise<AiFeedSummary[]> {
    if (!this.geminiApiKey) {
      this.logger.warn("GEMINI_API_KEY is not set. Using fallback summaries for AI feed items.");
      return [];
    }

    const llm = new ChatGoogleGenerativeAI({
      apiKey: this.geminiApiKey,
      model: this.geminiModel,
      temperature: 0.2,
      maxRetries: 1
    });

    const results: AiFeedSummary[] = [];

    for (const item of items) {
      try {
        const message = await llm.invoke(this.buildSummaryPrompt(item));
        const parsed = summarySchema.parse(this.parseSummaryJson(this.messageToText(message)));
        results.push({
          id: item.id,
          titleKo: parsed.titleKo,
          summaryKo: parsed.summaryKo,
          whyItMatters: parsed.whyItMatters,
          bullets: parsed.bullets
        });
      } catch (error) {
        this.logger.warn(
          `AI feed summary fallback for ${item.source}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return results;
  }

  private buildSummaryPrompt(item: RawAiFeedItem): string {
    return [
      "You are preparing a concise Korean AI news briefing for developers.",
      "Summarize the following article into raw JSON only.",
      'Keys: "titleKo", "summaryKo", "whyItMatters", "bullets".',
      "- titleKo: a Korean headline, 12 to 28 characters when possible.",
      "- summaryKo: 2 Korean sentences explaining the update plainly.",
      "- whyItMatters: 1 Korean sentence focusing on developer or product impact.",
      "- bullets: up to 3 short Korean bullet points.",
      "Do not include markdown fences or extra commentary.",
      "",
      `Source: ${item.source}`,
      `Original title: ${item.title}`,
      `Excerpt: ${item.excerpt}`,
      `Tags: ${item.tags.join(", ")}`
    ].join("\n");
  }

  private messageToText(message: AIMessage): string {
    if (typeof message.content === "string") {
      return message.content;
    }

    if (Array.isArray(message.content)) {
      return message.content
        .map((part) => {
          if (typeof part === "string") {
            return part;
          }

          if (part && typeof part === "object" && "text" in part) {
            return String((part as { text?: string }).text ?? "");
          }

          return "";
        })
        .join("");
    }

    return String(message.content ?? "");
  }

  private parseSummaryJson(rawText: string): unknown {
    let text = rawText.trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      text = fenced[1].trim();
    }

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) {
      throw new Error("summary_json_no_object");
    }

    text = text.slice(start, end + 1);
    text = text.replace(/\/\*[\s\S]*?\*\//g, "");
    text = text.replace(/,\s*([\]}])/g, "$1");

    return JSON.parse(text);
  }

  private buildFallbackSummary(item: RawAiFeedItem): string {
    if (item.excerpt) {
      return item.excerpt.slice(0, 180);
    }

    return `${item.source}에서 다룬 AI 관련 소식입니다.`;
  }
}
