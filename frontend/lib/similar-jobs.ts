export type SimilarJobPosting = {
  companyName: string;
  jobTitle: string;
  keywords: string[];
  link: string;
  reason: string;
};

type JobSeed = {
  companyName: string;
  jobTitle: string;
  keywords: string[];
  link: string;
};

const JOB_SEEDS: JobSeed[] = [
  {
    companyName: "데모테크",
    jobTitle: "Product Engineer (TypeScript/NestJS)",
    keywords: ["typescript", "nestjs", "postgresql", "llm", "workflow"],
    link: "https://example.com/jobs/product-engineer-typescript",
  },
  {
    companyName: "커리어플랫폼",
    jobTitle: "Fullstack Engineer (Next.js + AI Features)",
    keywords: ["next.js", "react", "typescript", "ai", "product"],
    link: "https://example.com/jobs/fullstack-ai-features",
  },
  {
    companyName: "데이터랩",
    jobTitle: "Backend Engineer (Automation Tools)",
    keywords: ["backend", "nestjs", "automation", "postgresql", "api"],
    link: "https://example.com/jobs/backend-automation-tools",
  },
  {
    companyName: "빌드업",
    jobTitle: "Frontend Product Engineer",
    keywords: ["react", "next.js", "ux", "dashboard", "typescript"],
    link: "https://example.com/jobs/frontend-product-engineer",
  },
  {
    companyName: "에이아이웍스",
    jobTitle: "AI Service Engineer (LLM Integrations)",
    keywords: ["llm", "langchain", "api", "prompt", "product"],
    link: "https://example.com/jobs/ai-service-engineer",
  },
];

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 2);
}

export function getSimilarJobPostings(targetJobPostingText: string): SimilarJobPosting[] {
  const tokens = new Set(tokenize(targetJobPostingText));
  if (tokens.size === 0) {
    return [];
  }

  return JOB_SEEDS.map((seed) => {
    const matched = seed.keywords.filter((keyword) => tokens.has(keyword.toLowerCase()));
    return {
      seed,
      matched,
      score: matched.length,
    };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ seed, matched }) => ({
      companyName: seed.companyName,
      jobTitle: seed.jobTitle,
      keywords: matched.slice(0, 3),
      link: seed.link,
      reason: `입력 공고와 ${matched.slice(0, 3).join(", ")} 키워드가 겹칩니다.`,
    }));
}
