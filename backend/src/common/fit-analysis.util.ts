import { CandidateProfile, GapAnalysis } from "../modules/langchain/workflow.types";

export type FitAnalysisSnapshot = {
  /** 0–100, AI 추정 서류·직무 적합도 (채용 합격/불합격을 보장하지 않음) */
  estimatedFitScore: number;
  scoreLabel: string;
  disclaimer: string;
  strengthsHighlight: string[];
  weakAreas: string[];
  improvementPoints: string[];
  previousEstimatedFitScore?: number;
  scoreDelta?: number;
  computedAt: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

type EvidenceStrength = "explicit_strong" | "partial" | "weak" | "missing";

function normalizeSignal(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, " ").trim();
}

function includesWord(text: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`, "i").test(text);
}

function buildCandidateCorpus(candidate: CandidateProfile | null | undefined): string {
  if (!candidate) return "";
  const chunks: string[] = [
    candidate.summary ?? "",
    ...(candidate.strengths ?? []),
    ...(candidate.experiences ?? []).flatMap((exp) => [exp.title, exp.impact, ...(exp.techStack ?? [])]),
    ...(candidate.projects ?? []).flatMap((p) => [p.name, p.description, ...(p.evidence ?? [])])
  ].filter(Boolean);
  return normalizeSignal(chunks.join(" "));
}

function classifyEvidence(signal: string, corpus: string): EvidenceStrength {
  const normalized = normalizeSignal(signal);
  if (!normalized) return "missing";
  if (corpus.includes(normalized)) return "explicit_strong";

  // 핵심 스택은 명시만 되어도 강한 근거로 취급해 과도한 감점을 방지한다.
  if (normalized.includes("typescript")) {
    if (includesWord(corpus, "typescript") || includesWord(corpus, "ts")) return "explicit_strong";
    return "missing";
  }

  const tokens = normalized.split(" ").filter((t) => t.length >= 3);
  if (tokens.length === 0) return "missing";
  const matchedTokens = tokens.filter((token) => corpus.includes(token)).length;
  if (matchedTokens >= Math.max(2, Math.ceil(tokens.length * 0.6))) return "partial";
  if (matchedTokens > 0) return "weak";
  return "missing";
}

/**
 * 갭 분석·프로필 요약으로부터 휴리스틱 적합도 점수를 산출한다.
 * LLM 호출 없이 결정적(deterministic)으로 계산한다.
 */
export function computeFitAnalysisSnapshot(
  gap: GapAnalysis,
  candidate: CandidateProfile | null | undefined,
  previous?: FitAnalysisSnapshot | null
): FitAnalysisSnapshot {
  const corpus = buildCandidateCorpus(candidate);
  const matchedSignals = (gap.matchedSignals ?? []).filter(Boolean);
  const missingSignals = (gap.missingSignals ?? []).filter(Boolean);
  const weakSignals = (gap.weakEvidence ?? []).filter(Boolean);

  const uniquePenaltySignals = new Map<string, { raw: string; level: EvidenceStrength }>();
  for (const signal of [...missingSignals, ...weakSignals]) {
    const key = normalizeSignal(signal);
    if (!key) continue;
    const level = classifyEvidence(signal, corpus);
    const existing = uniquePenaltySignals.get(key);
    if (!existing) {
      uniquePenaltySignals.set(key, { raw: signal, level });
      continue;
    }
    const rank: Record<EvidenceStrength, number> = {
      explicit_strong: 0,
      partial: 1,
      weak: 2,
      missing: 3
    };
    if (rank[level] > rank[existing.level]) {
      uniquePenaltySignals.set(key, { raw: signal, level });
    }
  }

  let score = 60;
  score += clamp(matchedSignals.length * 3, 0, 24);
  for (const { level } of uniquePenaltySignals.values()) {
    if (level === "missing") score -= 3;
    else if (level === "weak") score -= 2;
    else if (level === "partial") score -= 1;
  }
  // 핵심 스택이 명시돼 있으면 가산(예: TypeScript)
  if (includesWord(corpus, "typescript") || includesWord(corpus, "ts")) {
    score += 2;
  }
  score = clamp(Math.round(score), 18, 94);

  const strengthsHighlight = [
    ...matchedSignals.slice(0, 4),
    ...(candidate?.strengths ?? []).slice(0, 2)
  ]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 6);

  const weakAreas = Array.from(uniquePenaltySignals.values())
    .filter((item) => item.level === "missing" || item.level === "weak" || item.level === "partial")
    .slice(0, 8)
    .map((item) => (item.level === "partial" ? `${item.raw} (보강하면 좋음)` : item.raw));

  const improvementPoints: string[] = [];
  for (const { raw, level } of Array.from(uniquePenaltySignals.values()).slice(0, 5)) {
    if (level === "missing") {
      improvementPoints.push(`채용 공고에서 요구하는 "${raw}"은 현재 근거가 거의 보이지 않습니다. 역할·기간·결과 중 한 가지라도 추가해 주세요.`);
    } else if (level === "weak") {
      improvementPoints.push(`"${raw}"은 언급은 있으나 근거가 약합니다. 수치·산출물·검증 방법 중 하나를 덧붙이면 설득력이 올라갑니다.`);
    } else if (level === "partial") {
      improvementPoints.push(`"${raw}"은 일부 근거가 확인됩니다. 한 줄 사례를 더하면 완성도가 높아집니다.`);
    }
  }
  if (improvementPoints.length === 0) {
    improvementPoints.push("JD와 겹치는 키워드를 유지하면서, 성과·역할·기술 선택 이유를 한 줄씩만 더 구체화해 보세요.");
  }

  const prevScore = previous?.estimatedFitScore;
  const snapshot: FitAnalysisSnapshot = {
    estimatedFitScore: score,
    scoreLabel: "AI 추정 서류·직무 적합도",
    disclaimer:
      "이 점수는 채용 합격을 보장하지 않으며, 입력·갭 분석을 바탕으로 한 참고 지표입니다. 실제 서류/면접 평가와 다를 수 있습니다.",
    strengthsHighlight,
    weakAreas,
    improvementPoints: improvementPoints.slice(0, 7),
    computedAt: new Date().toISOString()
  };

  if (typeof prevScore === "number") {
    snapshot.previousEstimatedFitScore = prevScore;
    snapshot.scoreDelta = score - prevScore;
  }

  return snapshot;
}
