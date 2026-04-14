import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const artifactsDir = path.join(repoRoot, "docs", "test-artifacts");
const API_BASE = process.env.CAREERFLOW_API_BASE ?? "http://127.0.0.1:4000/v1";

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(pathname, { method = "GET", body, headers = {}, timeoutMs = 600_000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE}${pathname}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    const text = await response.text();
    let parsed = null;

    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!response.ok) {
      const message =
        typeof parsed === "object" && parsed && "message" in parsed
          ? Array.isArray(parsed.message)
            ? parsed.message.join("\n")
            : String(parsed.message)
          : `Request failed with status ${response.status}`;
      throw new ApiError(message, response.status, parsed);
    }

    return { status: response.status, data: parsed };
  } finally {
    clearTimeout(timeout);
  }
}

async function timed(label, fn) {
  const startedAt = new Date().toISOString();
  const started = performance.now();

  try {
    const result = await fn();
    return {
      label,
      ok: true,
      startedAt,
      durationMs: Number((performance.now() - started).toFixed(1)),
      status: result?.status ?? 200,
      data: result?.data ?? result
    };
  } catch (error) {
    return {
      label,
      ok: false,
      startedAt,
      durationMs: Number((performance.now() - started).toFixed(1)),
      status: error instanceof ApiError ? error.status : 0,
      error: error instanceof Error ? error.message : String(error),
      body: error instanceof ApiError ? error.body : undefined
    };
  }
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[index].toFixed(1));
}

function summarizeDurations(items) {
  const durations = items.filter((item) => item.ok).map((item) => item.durationMs);
  if (durations.length === 0) {
    return { count: 0, avgMs: null, minMs: null, maxMs: null, p95Ms: null };
  }

  const total = durations.reduce((sum, value) => sum + value, 0);
  return {
    count: durations.length,
    avgMs: Number((total / durations.length).toFixed(1)),
    minMs: Number(Math.min(...durations).toFixed(1)),
    maxMs: Number(Math.max(...durations).toFixed(1)),
    p95Ms: percentile(durations, 95)
  };
}

function makeSamplePayload(index, testUserId) {
  return {
    title: `perf-run-${index}`,
    testUserId,
    resumeText: [
      "한제만은 PM 경험을 기반으로 요구사항 분석, 일정 조율, 품질 기준 수립을 수행했고 이후 풀스택 개발로 전환했습니다.",
      "React, NestJS, Fastify, PostgreSQL 기반으로 웹 서비스를 구현했고 AWS 배포 구조와 AI 워크플로우 설계 경험을 보유하고 있습니다.",
      "대규모 데이터 프로젝트 운영 경험을 통해 우선순위 판단과 협업 구조 정리에 강점이 있습니다."
    ].join("\n"),
    portfolioText: [
      "CareerFlow AI는 이력서, 포트폴리오, 채용공고를 함께 분석해 보완 질문, 문서 초안, 면접 대비 리포트까지 이어지는 지원 준비 워크플로우 서비스입니다.",
      "LangChain 기반 단계형 파이프라인, structured output, fallback 전략, 재실행 제어, 상태 기록을 중심으로 설계했습니다.",
      "Essential Tour와 LMS 프로젝트를 통해 외부 API 연동, RBAC, 파일 업로드, 배포 구조 구성 경험도 보유하고 있습니다."
    ].join("\n"),
    projectDescriptions: [
      "CareerFlow AI: 단계형 분석 흐름, follow-up 질문 생성, 문서 초안 생성, 면접 대비 리포트 구성, WorkflowRun 기반 실행 추적.",
      "Essential Tour: Fastify, Prisma, PostgreSQL 기반 여행 정보 서비스. 외부 API 호출량을 줄이기 위해 요청 간격 제한과 캐시 구조를 적용.",
      "LMS: React, NestJS, TypeORM, PostgreSQL 기반 사내 교육 플랫폼. RBAC, OAuth2, 파일 업로드, 관리자 운영 기능 구현."
    ],
    targetJobPostingText: [
      "포지션: AI 활용 풀스택 엔지니어",
      "주요 업무: 요구사항을 빠르게 구조화하고 React/NestJS 기반 서비스를 구현하며 AI 도구를 개발 흐름에 연결합니다.",
      "자격 요건: 문제 해결력, 협업 능력, 문서화, 서비스 운영 관점, PostgreSQL 기반 데이터 모델 설계 경험.",
      "우대 사항: LangChain 또는 LLM 워크플로우 경험, AWS 배포 경험, 구조화된 출력 검증 경험."
    ].join("\n")
  };
}

function buildFollowupAnswers(questions) {
  return questions.map((question, index) => ({
    questionId: `q-${index + 1}`,
    answer: [
      `질문 ${index + 1}에 대한 보완 근거입니다.`,
      "요구사항을 먼저 정리하고 우선순위를 나눈 뒤, 구현 범위와 운영 영향을 함께 판단하며 진행했습니다.",
      "실제 프로젝트에서는 팀 커뮤니케이션과 일정 조율, 구현, 검증, 배포까지 연결한 경험을 보유하고 있습니다.",
      `원문 질문: ${question}`
    ].join(" ")
  }));
}

function summarizeWorkflowRuns(workflowRuns) {
  const byStage = {};
  const fallbackStages = [];
  const errorMessages = [];
  const models = new Set();

  for (const run of workflowRuns) {
    byStage[run.stage] = (byStage[run.stage] ?? 0) + 1;

    const llmRoute = run.inputJson?.llmRoute;
    const llmExecution = run.inputJson?.llmExecution;

    if (llmRoute?.model) {
      models.add(`${llmRoute.provider ?? "unknown"}:${llmRoute.model}`);
    }
    if (llmExecution?.fallbackUsed) {
      fallbackStages.push({
        stage: run.stage,
        reason: llmExecution.fallbackReason ?? "unknown"
      });
    }
    if (run.errorMessage) {
      errorMessages.push({
        stage: run.stage,
        errorMessage: run.errorMessage
      });
    }
  }

  return {
    totalRuns: workflowRuns.length,
    byStage,
    models: [...models],
    fallbackCount: fallbackStages.length,
    fallbackStages,
    errorMessages
  };
}

function computeBurstStats(results, batchDurationMs) {
  const ok = results.filter((item) => item.ok).length;
  const throughput = batchDurationMs > 0 ? Number((ok / (batchDurationMs / 1000)).toFixed(2)) : null;
  return {
    successfulRequests: ok,
    failedRequests: results.length - ok,
    batchDurationMs: Number(batchDurationMs.toFixed(1)),
    throughputRps: throughput,
    latency: summarizeDurations(results)
  };
}

async function createApplication(index, testUserId) {
  return timed(`create-source-${index}`, () =>
    api("/source-documents", {
      method: "POST",
      body: makeSamplePayload(index, testUserId)
    })
  );
}

async function fetchApplication(applicationId, testUserId) {
  return api(`/source-documents/${applicationId}`, {
    headers: { "x-test-user-id": testUserId }
  });
}

async function main() {
  const runStartedAt = new Date().toISOString();
  console.log(`[benchmark] started at ${runStartedAt}`);
  console.log(`[benchmark] api base = ${API_BASE}`);

  const testUser = await timed("create-test-user", () =>
    api("/source-documents/test-user", { method: "POST" })
  );
  if (!testUser.ok) {
    throw new Error(`Failed to create test user: ${testUser.error}`);
  }
  const testUserId = testUser.data.id;

  const createSequential = [];
  for (let index = 1; index <= 6; index += 1) {
    createSequential.push(await createApplication(index, testUserId));
  }

  const burstStarted = performance.now();
  const burstPromises = Array.from({ length: 12 }, (_, offset) => createApplication(100 + offset, testUserId));
  const burstResults = await Promise.all(burstPromises);
  const burstDurationMs = performance.now() - burstStarted;

  const mainApp = await createApplication(999, testUserId);
  if (!mainApp.ok) {
    throw new Error(`Failed to create main application: ${mainApp.error}`);
  }
  const mainApplicationId = mainApp.data.id;

  const analysis = await timed("analysis-main", () =>
    api("/analysis/run", {
      method: "POST",
      body: { applicationId: mainApplicationId, force: false },
      headers: { "x-test-user-id": testUserId }
    })
  );
  if (!analysis.ok) {
    throw new Error(`Analysis failed: ${analysis.error}`);
  }

  const mainAfterAnalysis = await fetchApplication(mainApplicationId, testUserId);
  const followUpQuestions = mainAfterAnalysis.data.followUpQuestions ?? [];
  const followUpAnswers = buildFollowupAnswers(followUpQuestions);

  const followupFirst = await timed("followup-submit-first", () =>
    api("/followup-questions/submit", {
      method: "POST",
      body: {
        applicationId: String(mainApplicationId),
        answers: followUpAnswers,
        force: false
      },
      headers: { "x-test-user-id": testUserId }
    })
  );

  const followupDuplicate = await timed("followup-submit-duplicate", () =>
    api("/followup-questions/submit", {
      method: "POST",
      body: {
        applicationId: String(mainApplicationId),
        answers: followUpAnswers,
        force: false
      },
      headers: { "x-test-user-id": testUserId }
    })
  );

  const documentsFirst = await timed("documents-generate-first", () =>
    api("/generated-documents/generate", {
      method: "POST",
      body: {
        applicationId: String(mainApplicationId),
        rewriteForJob: true,
        force: false
      },
      headers: { "x-test-user-id": testUserId }
    })
  );

  const documentsSkip = await timed("documents-generate-skip", () =>
    api("/generated-documents/generate", {
      method: "POST",
      body: {
        applicationId: String(mainApplicationId),
        rewriteForJob: true,
        force: false
      },
      headers: { "x-test-user-id": testUserId }
    })
  );

  const documentsExtraAllowed = [];
  for (let index = 0; index < 3; index += 1) {
    documentsExtraAllowed.push(
      await timed(`documents-generate-extra-${index + 1}`, () =>
        api("/generated-documents/generate", {
          method: "POST",
          body: {
            applicationId: String(mainApplicationId),
            rewriteForJob: true,
            force: false
          },
          headers: { "x-test-user-id": testUserId }
        })
      )
    );
  }

  const documentsRateLimit = await timed("documents-generate-rate-limit", () =>
    api("/generated-documents/generate", {
      method: "POST",
      body: {
        applicationId: String(mainApplicationId),
        rewriteForJob: true,
        force: false
      },
      headers: { "x-test-user-id": testUserId }
    })
  );

  await sleep(61_000);

  const interviewFirst = await timed("interview-generate-first", () =>
    api("/interview/generate", {
      method: "POST",
      body: {
        applicationId: String(mainApplicationId),
        force: false
      },
      headers: { "x-test-user-id": testUserId }
    })
  );

  const interviewSkip = await timed("interview-generate-skip", () =>
    api("/interview/generate", {
      method: "POST",
      body: {
        applicationId: String(mainApplicationId),
        force: false
      },
      headers: { "x-test-user-id": testUserId }
    })
  );

  const interviewExtraAllowed = [];
  for (let index = 0; index < 4; index += 1) {
    interviewExtraAllowed.push(
      await timed(`interview-generate-extra-${index + 1}`, () =>
        api("/interview/generate", {
          method: "POST",
          body: {
            applicationId: String(mainApplicationId),
            force: false
          },
          headers: { "x-test-user-id": testUserId }
        })
      )
    );
  }

  const interviewRateLimit = await timed("interview-generate-rate-limit", () =>
    api("/interview/generate", {
      method: "POST",
      body: {
        applicationId: String(mainApplicationId),
        force: false
      },
      headers: { "x-test-user-id": testUserId }
    })
  );

  await sleep(61_000);

  const conflictApp = await createApplication(2000, testUserId);
  if (!conflictApp.ok) {
    throw new Error(`Failed to create conflict application: ${conflictApp.error}`);
  }
  const conflictApplicationId = conflictApp.data.id;

  const firstConflictAnalysisPromise = timed("analysis-conflict-primary", () =>
    api("/analysis/run", {
      method: "POST",
      body: { applicationId: conflictApplicationId, force: false },
      headers: { "x-test-user-id": testUserId }
    })
  );
  await sleep(150);
  const secondConflictAnalysisPromise = timed("analysis-conflict-secondary", () =>
    api("/analysis/run", {
      method: "POST",
      body: { applicationId: conflictApplicationId, force: false },
      headers: { "x-test-user-id": testUserId }
    })
  );
  const [analysisConflictPrimary, analysisConflictSecondary] = await Promise.all([
    firstConflictAnalysisPromise,
    secondConflictAnalysisPromise
  ]);

  const mainFinal = await fetchApplication(mainApplicationId, testUserId);
  const conflictFinal = await fetchApplication(conflictApplicationId, testUserId);

  const summary = {
    runStartedAt,
    runFinishedAt: new Date().toISOString(),
    apiBase: API_BASE,
    testUserId,
    environment: {
      nodeVersion: process.version,
      note: "Executed against local Nest dev server on Windows with real PostgreSQL and Gemini provider configuration."
    },
    createSourceSequential: summarizeDurations(createSequential),
    createSourceBurst: computeBurstStats(burstResults, burstDurationMs),
    mainFlow: {
      applicationId: mainApplicationId,
      analysis,
      followupFirst,
      followupDuplicate,
      documentsFirst,
      documentsSkip,
      documentsExtraAllowed,
      documentsRateLimit,
      interviewFirst,
      interviewSkip,
      interviewExtraAllowed,
      interviewRateLimit,
      workflowSummary: summarizeWorkflowRuns(mainFinal.data.workflowRuns ?? []),
      finalStatus: mainFinal.data.status,
      followUpQuestionCount: followUpQuestions.length,
      generatedDraftKeys: Object.keys(mainFinal.data.generatedDraftJson ?? {})
    },
    conflictTest: {
      applicationId: conflictApplicationId,
      primary: analysisConflictPrimary,
      secondary: analysisConflictSecondary,
      workflowSummary: summarizeWorkflowRuns(conflictFinal.data.workflowRuns ?? []),
      finalStatus: conflictFinal.data.status
    }
  };

  const timestamp = runStartedAt.replace(/[:.]/g, "-");
  await mkdir(artifactsDir, { recursive: true });
  const artifactPath = path.join(artifactsDir, `careerflow-benchmark-${timestamp}.json`);
  await writeFile(artifactPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(`[benchmark] artifact written: ${artifactPath}`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("[benchmark] failed");
  console.error(error);
  process.exitCode = 1;
});
