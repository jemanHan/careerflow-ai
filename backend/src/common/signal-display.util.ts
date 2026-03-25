/**
 * 공고·갭 신호의 사용자 표시용 한국어 라벨·추천 문구.
 * 특정 JD/템플릿에 하드코딩되지 않도록 키워드·스크립트 계열만으로 주제를 나눈다.
 */

import { GapAnalysis } from "../modules/langchain/workflow.types";

export type SignalTheme =
  | "automation_tooling"
  | "web_portfolio_service"
  | "ai_llm_product"
  | "rag_retrieval"
  | "agent_workflow"
  | "generic_requirement";

const HANGUL = /[가-힣]/g;

function hangulRatio(text: string): number {
  const t = text.replace(/\s/g, "");
  if (t.length === 0) return 0;
  const m = t.match(HANGUL);
  return (m?.length ?? 0) / t.length;
}

/** 공백·개행만 정리. 저장 시 잘림(…) 금지. 과도한 길이만 상한. */
export function normalizeForStorage(value: string, maxChars = 480): string {
  const single = value.replace(/\s+/g, " ").trim();
  if (single.length <= maxChars) return single;
  const slice = single.slice(0, maxChars);
  const sp = slice.lastIndexOf(" ");
  const cut = sp > maxChars * 0.55 ? slice.slice(0, sp) : slice;
  return `${cut} …(이하 생략)`;
}

export function classifySignalTheme(text: string): SignalTheme {
  if (/문서·데이터 검색|rag|컨텍스트 설계|컨텍스트 주입/.test(text)) {
    return "rag_retrieval";
  }
  if (/에이전트|다단계\s*ai|다단계\s*워크플로/.test(text)) {
    return "agent_workflow";
  }
  if (/생성형\s*ai|llm 기능|llm·생성형/.test(text)) {
    return "ai_llm_product";
  }
  if (/실서비스|웹\s*서비스|포트폴리오\(동작/.test(text)) {
    return "web_portfolio_service";
  }
  if (/자동화|내부 도구|워크플로 구축|워크플로 자동화/.test(text)) {
    return "automation_tooling";
  }

  const t = text.toLowerCase();
  if (
    /\brag\b|retriev|vector\s*(db|store|database)|embedding|context\s*inject|chunk|문서\s*검색|임베딩|벡터\s*db/i.test(
      t
    )
  ) {
    return "rag_retrieval";
  }
  if (
    /\bagent\b|multi[\s-]?step|orchestr|tool[\s-]?(use|calling)|langgraph|autonomous|에이전트|다단계\s*워크플로/i.test(
      t
    )
  ) {
    return "agent_workflow";
  }
  if (
    /\bllm\b|large\s*language|generative\s*ai|gpt|gemini|claude|ai-?powered|프롬프트\s*엔지|생성형/i.test(t)
  ) {
    return "ai_llm_product";
  }
  if (
    /portfolio|web\s*service|production|live\s*site|deployed|public[\s-]?url|실서비스|배포\s*서비스|웹\s*서비스/i.test(
      t
    ) &&
    !/internal|내부용/i.test(t)
  ) {
    return "web_portfolio_service";
  }
  if (
    /automation|automate|workflow\s*tool|ci\s*\/\s*cd|pipeline|scripting|내부\s*도구|업무\s*자동화|크롤|스케줄/i.test(
      t
    )
  ) {
    return "automation_tooling";
  }
  return "generic_requirement";
}

/** 첫 절·첫 쉼표 앞만 사용해 짧은 구로 만든다(중간 … 잘림 없음). */
export function conciseClause(text: string, maxLen = 72): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  const delims = /([.。;；]| 및 | 또는 |,)/;
  const first = t.split(delims)[0]?.trim() ?? t;
  if (first.length > 0 && first.length <= maxLen + 12) return first.length > maxLen ? first.slice(0, maxLen) : first;
  const slice = t.slice(0, maxLen);
  const sp = slice.lastIndexOf(" ");
  return sp > maxLen * 0.45 ? slice.slice(0, sp) : slice;
}

/**
 * 공고 대비 부족·약한·맞는 점 목록용 한국어 라벨.
 * 원문이 이미 한국어 위주면 짧게만 다듬고, 영문·혼합이면 주제별 한국어 정식 라벨로 바꾼다.
 */
export function toKoreanRequirementLabel(raw: string): string {
  const normalized = normalizeForStorage(raw, 520);
  if (hangulRatio(normalized) >= 0.22) {
    return normalizeForStorage(normalized, 400);
  }
  const theme = classifySignalTheme(normalized);
  switch (theme) {
    case "automation_tooling":
      return "자동화·내부 도구·워크플로 구축·운영 경험";
    case "web_portfolio_service":
      return "실서비스·웹 서비스·포트폴리오(동작·배포) 증빙";
    case "ai_llm_product":
      return "생성형 AI·LLM 기능을 제품에 녹인 경험";
    case "rag_retrieval":
      return "문서·데이터 검색, RAG·컨텍스트 설계·구현 경험";
    case "agent_workflow":
      return "에이전트·다단계 AI 워크플로 설계·구현 경험";
    default:
      return `공고 명시 요건(이력서·포트폴리오와 키워드 대조): ${conciseClause(normalized, 96)}`;
  }
}

/** 강점·맞는 점: 짧은 근거 구문(한 줄). */
export function toKoreanStrengthPhrase(raw: string): string {
  const n = normalizeForStorage(raw, 400);
  if (hangulRatio(n) >= 0.2) {
    return conciseClause(n, 88);
  }
  const theme = classifySignalTheme(n);
  const tail = conciseClause(n, 48);
  switch (theme) {
    case "rag_retrieval":
      return `RAG·검색 파이프라인 관련 근거: ${tail}`;
    case "agent_workflow":
      return `에이전트·워크플로 관련 근거: ${tail}`;
    case "ai_llm_product":
      return `LLM·생성형 AI 적용 근거: ${tail}`;
    case "automation_tooling":
      return `자동화·도구화 근거: ${tail}`;
    case "web_portfolio_service":
      return `웹·서비스 출시·운영 근거: ${tail}`;
    default:
      return conciseClause(n, 72);
  }
}

/** 약한 근거: 본문만 저장. 느낌 설명은 UI 섹션 제목에서 처리한다. */
export function toKoreanWeakEvidencePhrase(raw: string): string {
  const normalized = normalizeForStorage(raw, 520);
  if (hangulRatio(normalized) >= 0.22) {
    return normalizeForStorage(normalized, 380);
  }
  return toKoreanRequirementLabel(raw);
}

export function recommendationForMissing(theme: SignalTheme): string {
  switch (theme) {
    case "automation_tooling":
      return "자동화·스크립트·내부 도구·업무 워크플로를 줄인 사례가 있으면 대상 업무, 기간, 산출물(링크·스크린샷 가능)을 한 줄로 적어 주세요. 직접 경험이 없으면 인접한 효율화·운영 개선만 구분해 짧게 써 주세요.";
    case "web_portfolio_service":
      return "실제 접속 가능한 서비스·데모, 배포 환경, 본인 역할(기여 범위)을 한 줄로 적어 주세요. 비공개라면 검증 가능한 산출물·스펙 요약으로 대체해 주세요.";
    case "ai_llm_product":
      return "LLM·생성형 AI를 어떤 사용자 시나리오에 넣었는지, 프롬프트·평가·안전장치 중 본인이 맡은 부분을 한 줄로 구체화해 주세요.";
    case "rag_retrieval":
      return "데이터 출처, 청킹·임베딩·검색 파이프라인, 품질 측정(재현율 등) 중 본인이 수행한 단계를 한 줄로 적어 주세요.";
    case "agent_workflow":
      return "에이전트·다단계 흐름에서 도구 호출·상태 관리·실패 처리 중 본인이 설계·구현한 부분을 한 줄로 적어 주세요.";
    default:
      return "공고의 해당 요건과 직접 연결되는 경험이 있으면 역할·기간·결과를 한 줄로 적고, 없으면 인접 경험만 범위를 구분해 짧게 적어 주세요.";
  }
}

export function recommendationForWeak(theme: SignalTheme): string {
  switch (theme) {
    case "automation_tooling":
      return "자동화·도구 관련 언급에 대해: 범위(몇 명이 쓰는지), 실행 주기, 오류·모니터링 방식 중 검증 가능한 항목을 한 줄로 보강해 주세요.";
    case "web_portfolio_service":
      return "서비스·포트폴리오 관련 언급에 대해: 트래픽·사용자 수·배포 방식·본인 기여 지점 중 증명 가능한 것을 한 줄로 덧붙여 주세요.";
    case "ai_llm_product":
      return "AI·LLM 관련 언급에 대해: 모델 선택 이유, 평가 지표, 비용·지연, 프롬프트 운영 중 본인이 맡은 부분을 한 줄로 구체화해 주세요.";
    case "rag_retrieval":
      return "RAG·검색 관련 언급에 대해: 코퍼스 규모, 재현 절차, 품질 이슈 대응 중 본인이 수행한 부분을 한 줄로 보강해 주세요.";
    case "agent_workflow":
      return "에이전트·워크플로 관련 언급에 대해: 단계 정의, 도구 목록, 실패 시 복구 전략 중 본인이 설계한 부분을 한 줄로 적어 주세요.";
    default:
      return "해당 항목은 언급은 있으나 증빙이 부족합니다. 수치·역할·산출물·검증 방법 중 보강 가능한 것을 한 줄로 덧붙여 주세요.";
  }
}

export function localizeGapAnalysisForDisplay(gap: GapAnalysis): GapAnalysis {
  const mapArr = (items: string[] | undefined, fn: (s: string) => string) =>
    (items ?? []).map((s) => fn(normalizeForStorage(s, 520))).filter((s) => s.length > 0);

  return {
    matchedSignals: mapArr(gap.matchedSignals, toKoreanStrengthPhrase),
    missingSignals: mapArr(gap.missingSignals, toKoreanRequirementLabel),
    weakEvidence: mapArr(gap.weakEvidence, toKoreanWeakEvidencePhrase)
  };
}

/** 저장·레거시 문자열 끝의 약한근거 설명 접미 제거(주제 분류·표시용). */
export function stripWeakEvidenceSuffix(value: string): string {
  let v = value.trim();
  v = v.replace(/\s*\(언급은 있으나 증빙·구체성이 부족\)\s*$/, "");
  v = v.replace(/\s*\(증빙 보강 권장\)\s*$/, "");
  v = v.replace(/\s*—\s*언급 대비 증빙이 약함\s*$/, "");
  v = v.replace(/\s*—\s*.+$/, "").trim();
  return v || value.trim();
}

export function buildThemedImprovementPoints(missing: string[], weak: string[], maxTotal: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const m of missing) {
    const theme = classifySignalTheme(m);
    const key = `m:${theme}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(recommendationForMissing(theme));
    if (out.length >= maxTotal) return out;
  }
  for (const w of weak) {
    const theme = classifySignalTheme(stripWeakEvidenceSuffix(w));
    const key = `w:${theme}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(recommendationForWeak(theme));
    if (out.length >= maxTotal) return out;
  }
  if (out.length === 0) {
    out.push(
      "공고 핵심 요구와 본인 경험의 연결을, 역할·사례·결과가 드러나게 한 줄씩 정리해 보세요."
    );
  }
  return out.slice(0, maxTotal);
}
