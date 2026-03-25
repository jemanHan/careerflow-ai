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

/** UI 노출 문장의 한글 비율(0~1). 영어 요약 누수 판별·필터에 사용. */
export function hangulRatio(text: string): number {
  const t = text.replace(/\s/g, "");
  if (t.length === 0) return 0;
  const m = t.match(HANGUL);
  return (m?.length ?? 0) / t.length;
}

/** 짧은 근거 구·특화 포인트 한 줄로 쓸 만큼 한글이 있는지 */
export function isHangulDominantForUi(text: string, minRatio = 0.22): boolean {
  return hangulRatio(text) >= minRatio;
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
      return "검증 가능한 경력·프로젝트 근거(수치·링크·산출물)";
  }
}

/** 사용자 부족 신호에 넣지 말 내부·메타형 문장. */
export function isUserFacingMissingMetaLine(s: string): boolean {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return true;
  return (
    /키워드\s*일치\s*여부\s*검토|서류·경력\s*키워드\s*일치\s*여부|검토\s*필요\s*\)\s*$/.test(t) ||
    /^공고에\s*명시된\s*요건\(서류/.test(t)
  );
}

/**
 * weak 신호를 부족 신호 목록에 넣을 때: 강점과 주제가 겹치면 '완전 누락'이 아니라 증빙 보강 문구로 바꾼다.
 */
export function formatWeakSignalForUserMissingHighlight(
  weakLabel: string,
  strengthHints: string[]
): string {
  const base = stripWeakEvidenceSuffix(weakLabel).trim();
  if (!base) return "";
  if (labelCoveredByStrengthHints(weakLabel, strengthHints)) {
    const theme = classifySignalTheme(base);
    switch (theme) {
      case "web_portfolio_service":
        return "검증 가능한 라이브 서비스 링크·배포·담당 범위 명시";
      case "ai_llm_product":
        return "제품에 적용한 생성형 AI·LLM 구체 사례(입력–분석–생성 흐름) 증빙 보강";
      case "rag_retrieval":
        return "RAG·문서 검색 구현의 직접 증빙(역할·데이터 범위·평가)";
      case "agent_workflow":
        return "에이전트·다단계 AI 패턴의 직접 증빙 보강";
      default:
        return `${conciseClause(base, 40)} — 구체 사례·증빙 보강 필요`;
    }
  }
  return base;
}

const STRENGTH_PHRASE_MAX = 56;

/** 갭 JSON 로컬라이즈용: 영문 신호는 테마별 한국어 라벨(저장·후속 단계용). */
function strengthPhraseKoreanOnlyFallbackLegacy(raw: string): string {
  const theme = classifySignalTheme(raw);
  switch (theme) {
    case "rag_retrieval":
      return "문서·데이터 검색·RAG·컨텍스트 설계 관련 경력 근거";
    case "agent_workflow":
      return "에이전트·다단계 AI 워크플로 관련 경력 근거";
    case "ai_llm_product":
      return "생성형 AI·LLM 기능 적용 관련 경력 근거";
    case "automation_tooling":
      return "업무 자동화·도구·워크플로 관련 경력 근거";
    case "web_portfolio_service":
      return "웹 서비스·배포·운영·실서비스 관련 경력 근거";
    default:
      return "공고·경력과 연결된 기술·업무 근거(서류·프로젝트 키워드 일치)";
  }
}

/** 사용자 강점 패널에 넣지 말아야 할 분석·메타형 문장(후보 근거 아님). */
export function isMetaStrengthOrAnalysisLine(s: string): boolean {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (/공고·경력과 연결된 기술·업무 근거|서류·프로젝트 키워드 일치/.test(t)) return true;
  if (
    /^(문서·데이터 검색·RAG·컨텍스트 설계|에이전트·다단계 AI 워크플로|생성형 AI·LLM 기능 적용|업무 자동화·도구·워크플로|웹 서비스·배포·운영·실서비스) 관련 경력 근거$/.test(
      t
    )
  ) {
    return true;
  }
  if (/^서류·경력에 근거가 있는 기술 스택\(키워드 일치\):/.test(t)) return false;
  return false;
}

/**
 * 강점·맞는 점: 짧은 근거 구문(한 줄, 한국어 중심).
 * `groundedOnly`: true면 서류에 한글이 충분할 때만 문구를 쓰고, 아니면 빈 문자열(스냅샷 강점 패널용).
 */
export function toKoreanStrengthPhrase(raw: string, groundedOnly = false): string {
  const n = normalizeForStorage(raw, 400);
  if (hangulRatio(n) >= 0.35) {
    return conciseClause(n, STRENGTH_PHRASE_MAX);
  }
  if (groundedOnly) return "";
  return strengthPhraseKoreanOnlyFallbackLegacy(raw);
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

/** 권장 문구용: 라벨·강점 문장 겹침 판별(도메인 테마 없음). */
function normalizeForOverlap(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSetForOverlap(text: string): Set<string> {
  return new Set(
    normalizeForOverlap(text)
      .split(/\s+/)
      .filter((t) => t.length >= 2)
  );
}

/** 신호 라벨이 이미 강점 요약에 충분히 반영된 경우(완전 누락보다는 증빙 보강에 가깝다). */
export function labelCoveredByStrengthHints(label: string, strengthHints: string[]): boolean {
  const blob = normalizeForOverlap(strengthHints.join(" "));
  const raw = stripWeakEvidenceSuffix(label).trim();
  const norm = normalizeForOverlap(raw);
  if (!norm || !blob) return false;
  if (norm.length >= 6 && blob.includes(norm)) return true;
  if (norm.length >= 10) {
    const head = norm.slice(0, Math.min(32, norm.length));
    if (blob.includes(head)) return true;
  }
  const lt = tokenSetForOverlap(raw);
  if (lt.size === 0) return false;
  let hit = 0;
  for (const t of lt) {
    if (blob.includes(t)) hit += 1;
  }
  return hit / lt.size >= 0.55;
}

const MAX_LABEL_IN_SENTENCE = 96;

function truncateLabelForRecommendation(label: string): string {
  const t = stripWeakEvidenceSuffix(label).trim();
  if (t.length <= MAX_LABEL_IN_SENTENCE) return t;
  return normalizeForStorage(t, MAX_LABEL_IN_SENTENCE);
}

/** weak 라벨이 협업·이해관계자 맥락이 강한지(직군 무관). */
function isCollaborationHeavySignal(s: string): boolean {
  return /(협업|이해관계자|크로스|커뮤니케이션|조율|stakeholder|파트너십|클라이언트|고객사|부서\s*간|이해관계|내부\s*합의)/i.test(
    s
  );
}

/** 짧거나 포괄적 표현 위주 → 역할·범위·절차 명확화 권장. */
function isVagueSignalLabel(s: string): boolean {
  const t = s.trim();
  if (t.length > 0 && t.length <= 16) return true;
  if (/(관련\s*경험|유사\s*경험|기본\s*역량|업무\s*이해)$/.test(t)) return true;
  if (/등\s*$/.test(t) && t.length < 48) return true;
  return false;
}

function hasMeasurableCueInLabel(s: string): boolean {
  return /(\d+%|\d+\s*%|pp\b|p\.p|KPI\s*\d|지표\s*\d|건수|명\s*이상|억|만\s*원|배\s*이상|달성률|증가율|전환율\s*\d)/.test(
    s
  );
}

/** 성과·목표형인데 수치·지표 언급이 거의 없을 때 측정 보강. */
function needsMetricOrOutcomeProof(s: string): boolean {
  const wantsOutcome = /(성과|목표|KPI|매출|전환|성장|ROI|리드|효율|개선|실적|달성|증대|기여도|임팩트)/.test(
    s
  );
  return wantsOutcome && !hasMeasurableCueInLabel(s);
}

/** 산출물·캠페인 등인데 검증 수단 언급이 적을 때. */
function needsArtifactOrLinkProof(s: string): boolean {
  const deliverableIsh = /(디자인|캠페인|콘텐츠|기획안|브랜드|리포트|영상|카피|배너|이벤트|세일즈|자료|시안|원고|크리에이티브)/.test(
    s
  );
  const hasProofCue = /(링크|URL|산출물|샘플|포트폴리오|첨부|공개|게시|캡처|문서화)/.test(s);
  return deliverableIsh && !hasProofCue;
}

function isProcessOrDetailHeavySignal(s: string): boolean {
  return /(프로세스|절차|단계|운영|기획|실험|검증|론칭|A\/B|워크플로|방법론)/.test(s);
}

function isToolUsageSignal(s: string): boolean {
  return /(도구|툴|플랫폼|시스템|스택|스위트|툴체인|툴킷)/.test(s);
}

/**
 * weak 신호에 대한 단일 권장: 증거 차원(협업 맥락·수치·산출물·절차·도구·깊이)만 사용.
 * SignalTheme·RAG/에이전트 등 직군 고정 분기 없음.
 */
function inferWeakEvidenceDimension(label: string): string {
  const L = stripWeakEvidenceSuffix(label).trim();
  if (!L) return "depth";
  if (isCollaborationHeavySignal(L)) return "collaboration";
  if (isVagueSignalLabel(L)) return "vague_scope";
  if (needsMetricOrOutcomeProof(L)) return "metric";
  if (needsArtifactOrLinkProof(L)) return "artifact";
  if (isProcessOrDetailHeavySignal(L)) return "process";
  if (isToolUsageSignal(L)) return "tool";
  return "depth";
}

function recommendationForMissingLabel(displayLabel: string): string {
  const theme = classifySignalTheme(stripWeakEvidenceSuffix(displayLabel));
  if (theme === "web_portfolio_service") {
    return "배포된 서비스가 있다면 링크와 담당 범위를 함께 적어 주세요.";
  }
  if (theme === "ai_llm_product") {
    return "LLM 기능은 어떤 입력–분석–생성 흐름으로 구현했는지 단계 중심으로 적어 주세요.";
  }
  if (theme === "rag_retrieval") {
    return "RAG·문서 검색은 데이터 범위·본인 역할·품질 확인 방식을 한 줄로 적어 주세요.";
  }
  if (theme === "agent_workflow") {
    return "에이전트·다단계 흐름은 도구 호출·상태 관리에서 본인이 맡은 부분을 구체적으로 적어 주세요.";
  }
  if (/(플로우|ux|ui|사용자|고객\s*경험|체험)/i.test(displayLabel)) {
    return "사용자 플로우 개선은 실제 전후 변화나 판단 기준을 한 줄로 덧붙여 주세요.";
  }
  return `${displayLabel}에 직접 대응하는 경험이 있으면 역할·기간·결과를 한 줄로 적어 보세요. 없다면 공고 요건과의 관계를 분명히 한 인접 경험만 짧게 적어 보세요.`;
}

function recommendationForWeakLabel(displayLabel: string, dimension: string): string {
  const theme = classifySignalTheme(stripWeakEvidenceSuffix(displayLabel));
  if (theme === "web_portfolio_service") {
    return "배포된 서비스가 있다면 링크와 담당 범위를 함께 적어 주세요.";
  }
  if (theme === "ai_llm_product") {
    return "LLM 기능은 어떤 입력–분석–생성 흐름으로 구현했는지 단계 중심으로 적어 주세요.";
  }
  if (theme === "rag_retrieval") {
    return "RAG·검색 구현은 코퍼스 범위·본인 단계·재현 방법을 한 줄로 보강해 주세요.";
  }
  if (theme === "agent_workflow") {
    return "에이전트·다단계 패턴은 단계 정의·도구·실패 처리 중 본인 역할을 한 줄로 적어 주세요.";
  }
  switch (dimension) {
    case "collaboration":
      return `${displayLabel}에 대해 협업 상대·의사결정 구조·본인 역할을 구분해 한 줄로 적어 보세요.`;
    case "vague_scope":
      return `${displayLabel}의 본인 역할, 기여 범위, 기간·대상 규모를 한 줄로 구체화해 보세요.`;
    case "metric":
      return `${displayLabel}에 대해 측정 가능한 결과(지표·전후 변화·목표 대비 성과)를 한 줄로 적어 보세요.`;
    case "artifact":
      return `${displayLabel}을(를) 뒷받침할 만한 링크·문서·시안·샘플 등 검증 가능한 산출물을 한 줄로 제시해 보세요.`;
    case "process":
      return `${displayLabel}의 진행 방식(절차·검증·의사결정 포인트) 중 본인이 맡은 부분을 한 줄로 적어 보세요.`;
    case "tool":
      return `${displayLabel}에서 사용한 도구·채널·환경과 본인이 수행한 작업을 구분해 한 줄로 적어 보세요.`;
    default:
      return `${displayLabel}에 대해 맥락·사례·결과 중 아직 드러나지 않은 한 가지를 한 줄만 보강해 보세요.`;
  }
}

/**
 * 사용자 노출용: 부족 신호·내부 weak 신호로 권장 문구만 생성. 약한 근거는 별도 섹션으로 노출하지 않는다.
 * 직군·도메인 고정 테마(RAG, 에이전트 등)에 의존하지 않고, 라벨 텍스트·범용 증거 차원으로만 문구를 만든다.
 */
export function buildUserFacingRecommendations(
  missing: string[],
  weakInternal: string[],
  strengthHints: string[],
  maxTotal: number
): string[] {
  const out: string[] = [];
  const seenLabelKeys = new Set<string>();

  const pushUnique = (line: string, labelKey: string) => {
    if (seenLabelKeys.has(labelKey)) return;
    seenLabelKeys.add(labelKey);
    out.push(line);
  };

  for (const m of missing) {
    if (out.length >= maxTotal) break;
    const display = truncateLabelForRecommendation(m);
    if (!display) continue;
    const key = normalizeForOverlap(display);
    if (!key) continue;
    if (labelCoveredByStrengthHints(m, strengthHints)) continue;
    pushUnique(recommendationForMissingLabel(display), key);
  }

  for (const w of weakInternal) {
    if (out.length >= maxTotal) break;
    const display = truncateLabelForRecommendation(w);
    if (!display) continue;
    const key = normalizeForOverlap(display);
    if (!key) continue;
    const dimension = inferWeakEvidenceDimension(w);
    pushUnique(recommendationForWeakLabel(display, dimension), key);
  }

  if (out.length === 0) {
    out.push(
      "강점은 유지한 채, 공고 문장과 직접 맞닿는 링크·수치·단계별 구현 내용을 항목마다 한 줄씩만 더하면 설득력이 올라갑니다."
    );
  }
  return out.slice(0, maxTotal);
}
