import { AiFeedSource } from "./ai-feed.types";

export const AI_FEED_MAX_ITEM_AGE_DAYS = 45;
export const AI_FEED_MAX_ITEMS_PER_SOURCE = 20;
export const AI_FEED_RESULT_LIMIT = 80;

export const aiFeedSources: AiFeedSource[] = [
  {
    id: "openai",
    label: "OpenAI News",
    homeUrl: "https://openai.com/news/",
    rssUrl: "https://openai.com/news/rss.xml",
    priority: 5,
    seedTags: ["GPT", "Release"]
  },
  {
    id: "google-ai",
    label: "Google AI Blog",
    homeUrl: "https://blog.google/technology/ai/",
    rssUrl: "https://blog.google/technology/ai/rss/",
    priority: 5,
    seedTags: ["Gemini", "Release"]
  },
  {
    id: "huggingface",
    label: "Hugging Face Blog",
    homeUrl: "https://huggingface.co/blog",
    rssUrl: "https://huggingface.co/blog/feed.xml",
    priority: 4,
    seedTags: ["Open Model"]
  },
  {
    id: "tldr-ai",
    label: "TLDR AI",
    homeUrl: "https://tldr.tech/ai",
    rssUrl: "https://tldr.tech/api/rss/ai",
    priority: 4,
    seedTags: ["Daily Briefing", "AI"]
  },
  {
    id: "import-ai",
    label: "Import AI",
    homeUrl: "https://importai.substack.com/",
    rssUrl: "https://importai.substack.com/feed",
    priority: 4,
    seedTags: ["Research", "Policy"]
  },
  {
    id: "bens-bites",
    label: "Ben's Bites",
    homeUrl: "https://www.bensbites.com/",
    rssUrl: "https://www.bensbites.com/feed",
    priority: 3,
    seedTags: ["AI", "Product"]
  },
  {
    id: "anthropic",
    label: "Anthropic News",
    homeUrl: "https://www.anthropic.com/news",
    rssUrl: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml",
    priority: 3,
    seedTags: ["Claude", "Release"]
  }
];

export const modelKeywordGroups = [
  {
    tag: "Claude",
    keywords: ["claude", "opus", "sonnet", "haiku", "anthropic", "claude code"]
  },
  {
    tag: "GPT",
    keywords: ["gpt-", "chatgpt", "openai", "o1", "o3", "o4", "codex"]
  },
  {
    tag: "Gemini",
    keywords: ["gemini", "google ai", "deepmind", "veo", "imagen", "gemma"]
  },
  {
    tag: "Open Model",
    keywords: ["llama", "qwen", "deepseek", "mistral", "open-weight", "open source model"]
  }
] as const;

export const topicKeywordGroups = [
  {
    tag: "Release",
    keywords: ["release", "launch", "introducing", "announcing", "available", "preview", "general availability"]
  },
  {
    tag: "Benchmark",
    keywords: ["benchmark", "eval", "evaluation", "score", "performance", "comparison", "leaderboard"]
  },
  {
    tag: "API",
    keywords: ["api", "sdk", "tool calling", "function calling", "response api", "developer", "endpoint"]
  },
  {
    tag: "Pricing",
    keywords: ["pricing", "price", "cost", "rate limit", "quota", "billing"]
  },
  {
    tag: "Agent",
    keywords: ["agent", "agents", "workflow", "automation", "assistant", "coding assistant"]
  },
  {
    tag: "Coding",
    keywords: ["code", "coding", "developer", "software engineering", "programming", "codex"]
  },
  {
    tag: "Research",
    keywords: ["paper", "research", "study", "training", "alignment", "reasoning", "science"]
  }
] as const;

export const llmNewsKeywords = [
  "claude",
  "opus",
  "sonnet",
  "haiku",
  "gpt",
  "chatgpt",
  "codex",
  "gemini",
  "deepmind",
  "gemma",
  "llm",
  "model",
  "reasoning",
  "benchmark",
  "eval",
  "api",
  "pricing",
  "agent",
  "coding",
  "release",
  "launch",
  "preview",
  "inference",
  "context window",
  "developer",
  "training",
  "alignment"
] as const;

export const strongLlmTitleKeywords = [
  "claude",
  "opus",
  "sonnet",
  "haiku",
  "claude code",
  "gpt",
  "chatgpt",
  "codex",
  "gemini",
  "gemma",
  "deepmind",
  "mistral",
  "deepseek",
  "llama",
  "qwen",
  "benchmark",
  "eval",
  "api",
  "agent",
  "release",
  "launch",
  "preview",
  "pricing"
] as const;
