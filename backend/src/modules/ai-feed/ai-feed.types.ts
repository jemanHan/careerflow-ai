export type AiFeedSource = {
  id: string;
  label: string;
  homeUrl: string;
  rssUrl: string;
  priority: number;
  seedTags?: string[];
};

export type RawAiFeedItem = {
  id: string;
  source: string;
  sourceUrl: string;
  link: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  tags: string[];
  score: number;
  titleKey: string;
};

export type AiFeedItem = {
  id: string;
  source: string;
  sourceUrl: string;
  link: string;
  publishedAt: string;
  title: string;
  titleKo: string;
  summaryKo: string;
  whyItMatters: string;
  bullets: string[];
  tags: string[];
  excerpt: string;
};

export type AiFeedSnapshot = {
  generatedAt: string;
  itemCount: number;
  sources: string[];
  items: AiFeedItem[];
};

export type AiFeedSummary = Pick<AiFeedItem, "id" | "titleKo" | "summaryKo" | "whyItMatters" | "bullets">;
