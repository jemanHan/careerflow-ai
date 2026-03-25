import { CandidateProfile, GapAnalysis, JobPostingProfile } from "../modules/langchain/workflow.types";
import {
  buildThemedImprovementPoints,
  localizeGapAnalysisForDisplay,
  normalizeForStorage,
  toKoreanStrengthPhrase,
  toKoreanWeakEvidencePhrase
} from "./signal-display.util";

export type FitAnalysisSnapshot = {
  /** UI·API 표시용 제목 (저장되어 레거시 클라이언트와도 호환) */
  analysisPanelTitle: string;
  disclaimer: string;
  strengthsHighlight: string[];
  weakAreas: string[];
  improvementPoints: string[];
  analysisQuality?: "normal" | "limited";
  qualityReason?: string;
  computedAt: string;
};

type EvidenceStrength = "explicit_strong" | "partial" | "weak" | "missing";

function normalizeSignal(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, " ").trim();
}

function semanticKey(value: string): string {
  return normalizeSignal(value).slice(0, 96);
}

function tokenSet(value: string): Set<string> {
  return new Set(
    normalizeSignal(value)
      .split(/\s+/)
      .filter((t) => t.length >= 2)
  );
}

/** 두 신호가 같은 주제로 간주될 만큼 겹치는지 (역할·직군 고정 없이 문자열·토큰 기반) */
function areSemanticallyDuplicate(a: string, b: string): boolean {
  const ka = semanticKey(a);
  const kb = semanticKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (ka.length >= 4 && kb.length >= 4 && (ka.includes(kb) || kb.includes(ka))) return true;
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let inter = 0;
  for (const x of ta) {
    if (tb.has(x)) inter += 1;
  }
  const uni = new Set([...ta, ...tb]).size;
  return uni > 0 && inter / uni >= 0.55;
}

/** 토큰 겹침이 낮아도 같은 직무 주제(배포·운영·LLM 등)면 강점/약점에 동시에 두지 않는다 */
const TOPIC_OVERLAP_BUCKETS: string[][] = [
  ["aws", "gcp", "azure", "배포", "운영", "인프라", "devops", "docker", "kubernetes", "k8s", "cloud", "ec2", "s3", "vercel", "배포환경", "운영환경", "인프라구성"],
  ["langchain", "llm", "생성형", "gemini", "openai", "프롬프트", "워크플로", "워크플로우", "체인", "rag", "에이전트", "agent"],
  ["nestjs", "node", "api", "백엔드", "postgresql", "prisma", "rest", "graphql"],
  ["react", "next", "nextjs", "프론트", "tailwind", "typescript", "javascript"]
];

function topicBucketOverlap(a: string, b: string): boolean {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  for (const bucket of TOPIC_OVERLAP_BUCKETS) {
    const hitA = bucket.some((t) => ta.has(t));
    const hitB = bucket.some((t) => tb.has(t));
    if (hitA && hitB) return true;
  }
  return false;
}

function signalsContradictStrengthAndWeak(strength: string, weak: string): boolean {
  if (areSemanticallyDuplicate(strength, weak)) return true;
  if (topicBucketOverlap(strength, weak)) return true;
  return false;
}

/** 단일 토큰 기술 키워드 — isMeaningfulSignal·강점 병합에서 공통 사용 */
const BARE_TECH_TOKENS = new Set([
  "typescript",
  "javascript",
  "nestjs",
  "react",
  "nextjs",
  "next js",
  "postgresql",
  "prisma",
  "aws",
  "docker",
  "kubernetes",
  "langchain",
  "python",
  "sql",
  "figma",
  "ga4",
  "seo",
  "rbac",
  "oauth2",
  "looker",
  "tableau",
  "excel",
  "notion",
  "jira",
  "slack"
]);

function dedupePhrases(phrases: string[], max: number): string[] {
  const cleaned = phrases.map((p) => p.replace(/\s+/g, " ").trim()).filter((p) => p.length > 0);
  const out: string[] = [];
  const sorted = [...cleaned].sort((a, b) => b.length - a.length);
  for (const p of sorted) {
    if (out.some((x) => areSemanticallyDuplicate(x, p))) continue;
    out.push(p);
    if (out.length >= max) break;
  }
  return out;
}

function isMeaningfulSignal(value: string): boolean {
  const n = normalizeSignal(value);
  if (!n || n.length < 2) return false;
  const stop = new Set([
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
    "필수",
    "직무",
    "역할",
    "있음",
    "가능",
    "실제",
    "활용해",
    "통해",
    "중심",
    "기반",
    "product",
    "engineer"
  ]);
  if (!n.includes(" ") && !BARE_TECH_TOKENS.has(n)) return false;
  if (stop.has(n)) return false;
  if (/^\d+$/.test(n)) return false;
  return true;
}

/** 저장·API용: 재분류 없이 중복·교차만 정리(이미 한국어 표시층을 거친 갭용). */
function sanitizeStoredGapForSnapshot(gap: GapAnalysis): GapAnalysis {
  let matched = dedupePhrases(gap.matchedSignals ?? [], 10).filter(isMeaningfulSignal);
  const rawMissing = dedupePhrases(gap.missingSignals ?? [], 12).filter(isMeaningfulSignal);
  const rawWeak = dedupePhrases(gap.weakEvidence ?? [], 12).filter(isMeaningfulSignal);

  for (const m of rawMissing) {
    const idx = rawWeak.findIndex((w) => areSemanticallyDuplicate(w, m));
    if (idx >= 0) rawWeak.splice(idx, 1);
  }

  matched = dedupePhrases(matched, 8).filter(isMeaningfulSignal);
  const weakNoMatchOverlap = dedupePhrases(rawWeak, 10).filter(
    (w) => !matched.some((m) => signalsContradictStrengthAndWeak(m, w))
  );
  return {
    matchedSignals: matched,
    missingSignals: dedupePhrases(rawMissing, 10),
    weakEvidence: weakNoMatchOverlap
  };
}

const RAW_CORPUS_MAX_CHARS = 120_000;

function buildCandidateCorpus(candidate: CandidateProfile | null | undefined, rawSourceText?: string): string {
  const chunks: string[] = [];
  if (candidate) {
    chunks.push(
      candidate.summary ?? "",
      ...(candidate.strengths ?? []),
      ...(candidate.experiences ?? []).flatMap((exp) => [exp.title, exp.impact, ...(exp.techStack ?? [])]),
      ...(candidate.projects ?? []).flatMap((p) => [p.name, p.description, ...(p.evidence ?? [])])
    );
  }
  if (rawSourceText?.trim()) {
    chunks.push(rawSourceText.slice(0, RAW_CORPUS_MAX_CHARS));
  }
  return normalizeSignal(chunks.filter(Boolean).join(" "));
}

/** 영·숫자 앵커(aws, ec2, cloudfront …) — 신호 문장에서 추가로 코퍼스와 대조 */
function extractAlphanumericAnchors(signal: string): string[] {
  const out = new Set<string>();
  const re = /[a-z][a-z0-9.\-]{1,24}/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(signal)) !== null) {
    const t = m[0].toLowerCase();
    if (t.length >= 2) out.add(t);
  }
  return [...out];
}

/** 신호가 코퍼스에 얼마나 뚜렷이 ‘박혀 있는지’ (한국어 2글자 토큰 포함) */
function evidenceHitRatio(signal: string, corpus: string): number {
  const normalized = normalizeSignal(signal);
  if (!normalized) return 0;
  if (corpus.includes(normalized)) return 1;

  const tokens = normalized.split(/\s+/).filter((t) => t.length >= 2);
  const anchors = extractAlphanumericAnchors(signal).map((a) => a.toLowerCase());
  const allTokens = [...new Set([...tokens, ...anchors])];
  if (allTokens.length === 0) return 0;
  let hits = 0;
  for (const t of allTokens) {
    if (t.length >= 2 && corpus.includes(t)) hits += 1;
  }
  return hits / allTokens.length;
}

function classifyEvidence(signal: string, corpus: string): EvidenceStrength {
  const normalized = normalizeSignal(signal);
  if (!normalized) return "missing";
  if (corpus.includes(normalized)) return "explicit_strong";

  const ratio = evidenceHitRatio(signal, corpus);
  if (ratio >= 0.72) return "explicit_strong";
  if (ratio >= 0.38) return "partial";
  if (ratio >= 0.14) return "weak";
  return "missing";
}

function signalMatchesJobPreferredOnly(job: JobPostingProfile | undefined, label: string): boolean {
  if (!job?.preferredSkills?.length) return false;
  const requiredLike = [
    ...(job.requiredSkills ?? []),
    ...(job.responsibilities ?? []),
    ...(job.evaluationSignals ?? [])
  ];
  const pref = job.preferredSkills.map((s) => normalizeSignal(String(s)));
  const ln = normalizeSignal(label);
  const hitsPreferred = pref.some((p) => p && (ln.includes(p) || p.includes(ln) || ln === p));
  const hitsRequired = requiredLike.some((r) => {
    const rn = normalizeSignal(String(r));
    return rn && (ln.includes(rn) || rn.includes(ln) || areSemanticallyDuplicate(label, String(r)));
  });
  return hitsPreferred && !hitsRequired;
}

function clusterPhrases(items: string[]): string[][] {
  const clusters: string[][] = [];
  for (const item of items) {
    const t = item.trim();
    if (!t) continue;
    let placed = false;
    for (const c of clusters) {
      if (c.some((x) => areSemanticallyDuplicate(x, t))) {
        c.push(t);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([t]);
  }
  return clusters;
}

function pickCanonical(cluster: string[]): string {
  return [...cluster].sort((a, b) => b.length - a.length)[0] ?? "";
}

/**
 * 갭 결과를 저장·표시 전에 정리한다.
 * - missing / weak 상호 배타
 * - 의미 중복 클러스터는 하나의 표현으로 병합
 * - 후보 말뭉치 대비 증거 강도에 따라 버킷 재분류 (버즈워드만 있으면 missing/weak로 하향)
 */
export function finalizeGapAnalysis(
  gap: GapAnalysis,
  candidate: CandidateProfile | null | undefined,
  rawSourceText?: string,
  job?: JobPostingProfile | null
): GapAnalysis {
  const corpus = buildCandidateCorpus(candidate, rawSourceText);
  let matched = dedupePhrases(gap.matchedSignals ?? [], 10).filter(isMeaningfulSignal);
  const rawMissing = dedupePhrases(gap.missingSignals ?? [], 12).filter(isMeaningfulSignal);
  const rawWeak = dedupePhrases(gap.weakEvidence ?? [], 12).filter(isMeaningfulSignal);

  const combined = clusterPhrases([...rawMissing, ...rawWeak]);
  const nextMissing: string[] = [];
  const nextWeak: string[] = [];

  for (const cluster of combined) {
    const canonical = pickCanonical(cluster);
    if (!canonical) continue;
    let level = classifyEvidence(canonical, corpus);
    const label = normalizeForStorage(canonical, 400);
    const ratio = evidenceHitRatio(canonical, corpus);

    if (level === "missing" && job && signalMatchesJobPreferredOnly(job, label) && ratio >= 0.12) {
      level = ratio >= 0.35 ? "partial" : "weak";
    }

    if (level === "explicit_strong") {
      if (!matched.some((m) => areSemanticallyDuplicate(m, label))) {
        matched.push(label);
      }
      continue;
    }
    if (level === "missing") {
      if (!nextMissing.some((m) => areSemanticallyDuplicate(m, label))) {
        nextMissing.push(label);
      }
      continue;
    }
    if (level === "partial" || level === "weak") {
      if (!nextWeak.some((w) => areSemanticallyDuplicate(w, label))) {
        nextWeak.push(label);
      }
    }
  }

  matched = dedupePhrases(matched, 8).filter(isMeaningfulSignal);
  const missingSignals = dedupePhrases(nextMissing, 10);
  let weakEvidence = dedupePhrases(nextWeak, 10);

  for (const m of missingSignals) {
    const idx = weakEvidence.findIndex((w) => areSemanticallyDuplicate(w, m));
    if (idx >= 0) weakEvidence.splice(idx, 1);
  }

  weakEvidence = weakEvidence.filter((w) => !matched.some((m) => signalsContradictStrengthAndWeak(m, w)));

  return {
    matchedSignals: matched,
    missingSignals,
    weakEvidence
  };
}

function collectConcreteCandidateLines(candidate: CandidateProfile | null | undefined, max: number): string[] {
  if (!candidate) return [];
  const lines: string[] = [];
  for (const p of candidate.projects ?? []) {
    for (const e of p.evidence ?? []) {
      const t = String(e ?? "").trim();
      if (t.length >= 8 && isMeaningfulSignal(t)) lines.push(t);
    }
    const d = (p.description ?? "").trim();
    if (d.length >= 12 && isMeaningfulSignal(d)) lines.push(normalizeForStorage(d, 320));
  }
  for (const exp of candidate.experiences ?? []) {
    const im = (exp.impact ?? "").trim();
    if (im.length >= 8 && isMeaningfulSignal(im)) lines.push(normalizeForStorage(im, 320));
  }
  return dedupePhrases(lines, max);
}

/** 포트폴리오 '프로젝트 A.' 식 제목만 강점에 올리지 않기 위한 휴리스틱 */
function isPortfolioProjectCodeHeading(value: string): boolean {
  const t = value.trim();
  return /^프로젝트\s+[A-Za-z0-9가-힣]{1,4}\s*[.:·\-、]\s*\S/.test(t);
}

/** LLM이 기술 키워드만 matched에 넣은 경우 한 줄로 묶어 가독성 확보 */
function buildStrengthPhrasesFromMatched(matchedSignals: string[]): string[] {
  const bare: string[] = [];
  const rich: string[] = [];
  for (const raw of matchedSignals) {
    const n = normalizeSignal(raw);
    if (!n.includes(" ") && BARE_TECH_TOKENS.has(n)) bare.push(raw.trim());
    else rich.push(toKoreanStrengthPhrase(raw));
  }
  if (bare.length >= 2) {
    const pretty = bare.map((b) => b.replace(/^[a-z]/i, (c) => c.toUpperCase())).join(", ");
    return [`공고·경력에 근거가 있는 기술 스택: ${pretty}`, ...rich];
  }
  return matchedSignals.map((s) => toKoreanStrengthPhrase(s));
}

/** 서류 한 줄이 공고에서 뽑은 요건·우대·업무 신호와 주제적으로 겹치는지 */
function alignsWithJobSignals(phrase: string, jobSignals: string[]): boolean {
  const p = phrase.trim();
  if (!p || jobSignals.length === 0) return false;
  for (const js of jobSignals) {
    if (areSemanticallyDuplicate(p, js)) return true;
    const ta = tokenSet(p);
    const tb = tokenSet(js);
    if (ta.size === 0 || tb.size === 0) continue;
    let inter = 0;
    for (const x of ta) {
      if (tb.has(x)) inter += 1;
    }
    if (inter >= 2) return true;
    if (inter === 1 && ta.size <= 6 && tb.size <= 10) return true;
  }
  return false;
}

/**
 * 갭 분석·프로필 요약으로부터 공고 대비 장·단점·보완 요약 스냅샷을 만든다.
 * LLM 호출 없이 결정적(deterministic)으로 계산한다.
 */
export function computeFitAnalysisSnapshot(
  gap: GapAnalysis,
  candidate: CandidateProfile | null | undefined,
  job?: JobPostingProfile | null,
  rawSourceText?: string
): FitAnalysisSnapshot {
  /** 프로젝트 코드형 제목(p.name)은 강점 후보에서 제외 — 설명·근거만 후보에 둔다 */
  const candidateSignals = [
    ...(candidate?.strengths ?? []),
    ...(candidate?.experiences ?? []).flatMap((exp) => [exp.title, ...(exp.techStack ?? [])]),
    ...(candidate?.projects ?? []).flatMap((p) => [...(p.evidence ?? [])])
  ]
    .map((v) => String(v ?? "").trim())
    .filter((v) => v.length > 0)
    .filter(isMeaningfulSignal);

  const jobSignals = [
    ...(job?.requiredSkills ?? []),
    ...(job?.preferredSkills ?? []),
    ...(job?.responsibilities ?? []),
    ...(job?.evaluationSignals ?? []),
    ...(job?.domainSignals ?? []),
    ...(job?.toolSignals ?? []),
    ...(job?.outputExpectations ?? [])
  ]
    .map((v) => String(v ?? "").trim())
    .filter((v) => v.length > 0)
    .filter(isMeaningfulSignal)
    .filter((v, i, arr) => arr.findIndex((x) => semanticKey(x) === semanticKey(v)) === i);

  const corpus = buildCandidateCorpus(candidate);

  let workingGap: GapAnalysis = {
    matchedSignals: [...(gap.matchedSignals ?? [])],
    missingSignals: [...(gap.missingSignals ?? [])],
    weakEvidence: [...(gap.weakEvidence ?? [])]
  };

  const emptyGap =
    (workingGap.matchedSignals?.length ?? 0) === 0 &&
    (workingGap.missingSignals?.length ?? 0) === 0 &&
    (workingGap.weakEvidence?.length ?? 0) === 0;

  if (emptyGap && jobSignals.length > 0) {
    const inferredMatched: string[] = [];
    const inferredMissing: string[] = [];
    const inferredWeak: string[] = [];
    for (const jobSignal of jobSignals.slice(0, 10)) {
      const level = classifyEvidence(jobSignal, corpus);
      const label = normalizeForStorage(jobSignal, 400);
      if (level === "explicit_strong") inferredMatched.push(label);
      else if (level === "partial") inferredWeak.push(label);
      else if (level === "weak") inferredWeak.push(label);
      else inferredMissing.push(label);
    }
    workingGap = localizeGapAnalysisForDisplay(
      finalizeGapAnalysis(
        {
          matchedSignals: inferredMatched,
          missingSignals: inferredMissing,
          weakEvidence: inferredWeak
        },
        candidate,
        rawSourceText,
        job
      )
    );
  }

  const gapFinal = sanitizeStoredGapForSnapshot(workingGap);

  const matchedSignals = (gapFinal.matchedSignals ?? []).filter(isMeaningfulSignal);
  const missingSignals = (gapFinal.missingSignals ?? []).filter(isMeaningfulSignal);
  const weakSignals = (gapFinal.weakEvidence ?? []).filter(isMeaningfulSignal);

  const concreteLines = collectConcreteCandidateLines(candidate, 10);
  const fromMatched = buildStrengthPhrasesFromMatched(matchedSignals);

  const jobAlignedExtras: string[] = [];
  if (jobSignals.length > 0) {
    for (const line of concreteLines) {
      if (isPortfolioProjectCodeHeading(line)) continue;
      if (!alignsWithJobSignals(line, jobSignals)) continue;
      jobAlignedExtras.push(toKoreanStrengthPhrase(line));
    }
    for (const sig of dedupePhrases(candidateSignals, 14)) {
      if (isPortfolioProjectCodeHeading(sig)) continue;
      if (!alignsWithJobSignals(sig, jobSignals)) continue;
      jobAlignedExtras.push(toKoreanStrengthPhrase(sig));
    }
  }

  const strengthsHighlight = dedupePhrases([...fromMatched, ...jobAlignedExtras], 14).slice(0, 8);

  const weakDeduped = dedupePhrases(weakSignals, 12);
  const weakAreasFiltered = weakDeduped.filter(
    (w) => !strengthsHighlight.some((s) => signalsContradictStrengthAndWeak(s, w))
  );

  const weakAreas =
    weakAreasFiltered.length > 0 ? weakAreasFiltered.slice(0, 10) : ["특이 사항 없음"];

  const improvementPoints = buildThemedImprovementPoints(missingSignals, weakAreasFiltered, 4);

  return {
    analysisPanelTitle: "공고 대상 장·단점 분석",
    disclaimer:
      "입력 서류와 채용공고를 비교한 참고 요약이며, 실제 서류·면접 평가나 채용 결과를 보장하지 않습니다.",
    strengthsHighlight,
    weakAreas,
    improvementPoints,
    computedAt: new Date().toISOString()
  };
}

/** DB에 저장된 공고 대상 장·단점 분석(1단계) 존재 여부 — 문서 생성 API 선행 조건 */
export function hasStoredFitAnalysis(fit: unknown): boolean {
  if (!fit || typeof fit !== "object") return false;
  const obj = fit as { estimatedFitScore?: unknown; computedAt?: unknown };
  if (typeof obj.estimatedFitScore === "number") return true;
  return typeof obj.computedAt === "string";
}
