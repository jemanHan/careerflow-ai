export type JobSearchKeywordRecommendation = {
  rank: 1 | 2 | 3;
  focusRole: string;
  keywords: string[];
  query: string;
  reason: string;
};

type JobSignalInput = {
  role?: string;
  requiredSkills?: string[];
  preferredSkills?: string[];
  responsibilities?: string[];
  evaluationSignals?: string[];
  domainSignals?: string[];
  collaborationSignals?: string[];
  toolSignals?: string[];
  senioritySignals?: string[];
  outputExpectations?: string[];
};

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 2);
}

export function getSimilarJobPostings(targetJobPostingText: string, jobSignals?: JobSignalInput): JobSearchKeywordRecommendation[] {
  const signalText = [
    targetJobPostingText,
    jobSignals?.role ?? "",
    ...(jobSignals?.requiredSkills ?? []),
    ...(jobSignals?.preferredSkills ?? []),
    ...(jobSignals?.responsibilities ?? []),
    ...(jobSignals?.evaluationSignals ?? []),
    ...(jobSignals?.domainSignals ?? []),
    ...(jobSignals?.collaborationSignals ?? []),
    ...(jobSignals?.toolSignals ?? []),
    ...(jobSignals?.senioritySignals ?? []),
    ...(jobSignals?.outputExpectations ?? [])
  ]
    .filter(Boolean)
    .join(" ");
  const tokens = tokenize(signalText);
  if (tokens.length === 0) {
    return [];
  }

  const uniq = tokens.filter((t, idx, arr) => arr.indexOf(t) === idx);
  const roleToken = tokenize(jobSignals?.role ?? targetJobPostingText).slice(0, 3).join(" ");
  const required = (jobSignals?.requiredSkills ?? []).flatMap((v) => tokenize(v)).slice(0, 8);
  const preferred = (jobSignals?.preferredSkills ?? []).flatMap((v) => tokenize(v)).slice(0, 6);
  const responsibility = (jobSignals?.responsibilities ?? []).flatMap((v) => tokenize(v)).slice(0, 6);
  const base = [...required, ...preferred, ...responsibility, ...uniq].filter((v, i, arr) => arr.indexOf(v) === i);

  const packs = [
    base.slice(0, 4),
    [...required.slice(0, 2), ...preferred.slice(0, 2), ...responsibility.slice(0, 2)].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 4),
    [...required.slice(2, 5), ...responsibility.slice(0, 2), ...uniq.slice(0, 2)].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 4)
  ].filter((p) => p.length > 0).slice(0, 3);

  return packs.map((pack, index) => {
    const rolePart = roleToken || "job";
    const query = `${rolePart} ${pack.join(" ")}`.trim();
    return {
      rank: (index + 1) as 1 | 2 | 3,
      focusRole: jobSignals?.role?.trim() || "JD 중심 직무",
      keywords: pack.slice(0, 3),
      query,
      reason: `JD에서 추출된 요구 신호(${pack.slice(0, 3).join(", ")})를 기준으로 탐색 우선순위를 정했습니다.`
    };
  });
}
