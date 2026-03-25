import { CandidateProfile, GapAnalysis, JobPostingProfile } from "./workflow.types";

/**
 * JD·갭·후보 신호의 DB/내부 JSON은 영문일 수 있으나, 면접 생성 LLM 입력은
 * 사용자 노출용 한국어 표시 레이어(job_display_ko 등)로만 전달해
 * 질문 본문에 영문 요구문이 그대로 붙는 것을 줄인다.
 */

function normalizePhraseKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[＂＂]/g, '"');
}

/** 알려진 영문 JD 요구문 → 자연스러운 한국어 */
const PHRASE_MAP: Record<string, string> = {
  "typescript-based web development": "TypeScript 기반 웹 개발 경험",
  "react or next.js development": "React 또는 Next.js 기반 프론트엔드 개발 경험",
  "react or nextjs development": "React 또는 Next.js 기반 프론트엔드 개발 경험",
  "node.js or nestjs api development": "Node.js 또는 NestJS 기반 API 개발 경험",
  "nodejs or nestjs api development": "Node.js 또는 NestJS 기반 API 개발 경험"
};

const TECH_TOKEN_MAP: Array<{ re: RegExp; ko: string }> = [
  { re: /\btypescript\b/gi, ko: "TypeScript" },
  { re: /\bjavascript\b/gi, ko: "JavaScript" },
  { re: /\bnext\.js\b/gi, ko: "Next.js" },
  { re: /\bnextjs\b/gi, ko: "Next.js" },
  { re: /\breact\b/gi, ko: "React" },
  { re: /\bnode\.js\b/gi, ko: "Node.js" },
  { re: /\bnodejs\b/gi, ko: "Node.js" },
  { re: /\bnestjs\b/gi, ko: "NestJS" },
  { re: /\bvue\.?js\b/gi, ko: "Vue.js" },
  { re: /\bangular\b/gi, ko: "Angular" },
  { re: /\bpython\b/gi, ko: "Python" },
  { re: /\bjava\b/gi, ko: "Java" },
  { re: /\bkotlin\b/gi, ko: "Kotlin" },
  { re: /\bgo\b/gi, ko: "Go" },
  { re: /\brust\b/gi, ko: "Rust" },
  { re: /\baws\b/gi, ko: "AWS" },
  { re: /\bgcp\b/gi, ko: "GCP" },
  { re: /\bazure\b/gi, ko: "Azure" },
  { re: /\bdocker\b/gi, ko: "Docker" },
  { re: /\bkubernetes\b/gi, ko: "Kubernetes" },
  { re: /\bk8s\b/gi, ko: "Kubernetes" },
  { re: /\bpostgresql\b/gi, ko: "PostgreSQL" },
  { re: /\bmysql\b/gi, ko: "MySQL" },
  { re: /\bmongodb\b/gi, ko: "MongoDB" },
  { re: /\bredis\b/gi, ko: "Redis" },
  { re: /\bgraphql\b/gi, ko: "GraphQL" },
  { re: /\brest\s*api\b/gi, ko: "REST API" },
  { re: /\bapi\b/gi, ko: "API" },
  { re: /\bfigma\b/gi, ko: "Figma" },
  { re: /\bui\/ux\b/gi, ko: "UI/UX" },
  { re: /\bux\b/gi, ko: "UX" },
  { re: /\bui\b/gi, ko: "UI" }
];

function hangulCount(s: string): number {
  return (s.match(/[\u3131-\u318E\uAC00-\uD7A3]/g) ?? []).length;
}

function latinLetterCount(s: string): number {
  return (s.match(/[A-Za-z]/g) ?? []).length;
}

function isPrimarilyKorean(s: string): boolean {
  const h = hangulCount(s);
  const l = latinLetterCount(s);
  if (h === 0) return false;
  return h >= l * 0.35;
}

function glossTechTokens(s: string): string {
  let out = s;
  for (const { re, ko } of TECH_TOKEN_MAP) {
    out = out.replace(re, ko);
  }
  return out;
}

function englishClauseToKoreanDescription(raw: string): string {
  const t = glossTechTokens(raw.trim());
  const lower = t.toLowerCase();
  const parts: string[] = [];

  if (/\bweb\b|\bfrontend\b|\bfront-end\b|\b웹\b/i.test(lower)) {
    parts.push("웹");
  }
  if (/\bbackend\b|\bback-end\b|\bserver\b/i.test(lower)) {
    parts.push("서버·백엔드");
  }
  if (/\bmobile\b|\bios\b|\bandroid\b/i.test(lower)) {
    parts.push("모바일");
  }
  if (/\bapi\b/i.test(lower)) {
    parts.push("API");
  }
  if (/\bdesign\b|\bux\b|\bui\b|\bfigma\b/i.test(lower)) {
    parts.push("디자인·사용자 경험");
  }
  if (/\bdata\b|\banalytics\b|\bml\b|\bai\b/i.test(lower)) {
    parts.push("데이터·분석");
  }
  if (/\bmarketing\b|\bbrand\b|\bcampaign\b/i.test(lower)) {
    parts.push("마케팅");
  }
  if (/\bpm\b|\bproduct\b|\bproject\s*management\b/i.test(lower)) {
    parts.push("프로덕트·기획");
  }
  if (/\boperation\b|\bops\b|\bcs\b|\bsupport\b/i.test(lower)) {
    parts.push("운영");
  }

  const techBits = t.match(/[A-Za-z][A-Za-z0-9.+]*(?:\s*\/\s*[A-Za-z][A-Za-z0-9.+]*)*/g);
  const techPhrase =
    techBits && techBits.length > 0
      ? `${techBits.slice(0, 4).join(", ")} 관련 실무 역량`
      : "공고에 기술된 실무 요건";

  if (parts.length > 0) {
    return `${parts.join("·")} 영역의 ${techPhrase}`;
  }
  return `${techPhrase}에 해당하는 업무 경험`;
}

export function toInterviewDisplayLabelKo(raw: string): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return "";

  const mapped = PHRASE_MAP[normalizePhraseKey(trimmed)];
  if (mapped) return mapped;

  if (isPrimarilyKorean(trimmed)) return trimmed;

  const glossed = glossTechTokens(trimmed);
  if (isPrimarilyKorean(glossed)) return glossed;

  return englishClauseToKoreanDescription(glossed);
}

function mapStrings(arr: string[] | undefined): string[] {
  return (arr ?? []).map((s) => toInterviewDisplayLabelKo(s)).filter((s) => s.length > 0);
}

export function buildJobPostingProfileDisplayKo(job: JobPostingProfile): JobPostingProfile {
  return {
    role: toInterviewDisplayLabelKo(job.role) || job.role,
    summary: job.summary ? toInterviewDisplayLabelKo(job.summary) : job.summary,
    requiredSkills: mapStrings(job.requiredSkills),
    preferredSkills: mapStrings(job.preferredSkills),
    responsibilities: mapStrings(job.responsibilities),
    evaluationSignals: mapStrings(job.evaluationSignals),
    domainSignals: job.domainSignals ? mapStrings(job.domainSignals) : job.domainSignals,
    collaborationSignals: job.collaborationSignals ? mapStrings(job.collaborationSignals) : job.collaborationSignals,
    toolSignals: job.toolSignals ? mapStrings(job.toolSignals) : job.toolSignals,
    senioritySignals: job.senioritySignals ? mapStrings(job.senioritySignals) : job.senioritySignals,
    outputExpectations: job.outputExpectations ? mapStrings(job.outputExpectations) : job.outputExpectations
  };
}

export function buildGapAnalysisDisplayKo(gap: GapAnalysis): GapAnalysis {
  return {
    matchedSignals: mapStrings(gap.matchedSignals),
    missingSignals: mapStrings(gap.missingSignals),
    weakEvidence: mapStrings(gap.weakEvidence)
  };
}

export function buildCandidateProfileInterviewDisplayKo(candidate: CandidateProfile): CandidateProfile {
  return {
    summary: candidate.summary ? toInterviewDisplayLabelKo(candidate.summary) : candidate.summary,
    strengths: mapStrings(candidate.strengths),
    experiences: (candidate.experiences ?? []).map((e) => ({
      title: toInterviewDisplayLabelKo(e.title) || e.title,
      impact: toInterviewDisplayLabelKo(e.impact) || e.impact,
      techStack: (e.techStack ?? []).map((t) => toInterviewDisplayLabelKo(t))
    })),
    projects: (candidate.projects ?? []).map((p) => ({
      name: toInterviewDisplayLabelKo(p.name) || p.name,
      description: toInterviewDisplayLabelKo(p.description) || p.description,
      evidence: mapStrings(p.evidence)
    }))
  };
}

export function toPrioritizedProjectContextDisplayKo(context: string | undefined): string {
  if (!context?.trim()) return "N/A";
  return context
    .split(/\r?\n/)
    .map((line) => toInterviewDisplayLabelKo(line) || line.trim())
    .filter(Boolean)
    .join("\n");
}
