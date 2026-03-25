const FALLBACK_LOCAL_API_BASE = "http://localhost:4000/v1";

function resolveApiBase() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const nodeEnv = process.env.NODE_ENV;
  if (configured) return configured;
  if (nodeEnv === "production") {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is required in production.");
  }
  return FALLBACK_LOCAL_API_BASE;
}

const API_BASE = resolveApiBase();

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function getActiveTestUserId() {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem("careerflow-test-user-id") ?? "";
}

function withTestUserHeader(headers?: HeadersInit): HeadersInit {
  const activeTestUserId = getActiveTestUserId().trim();
  if (!activeTestUserId) {
    return headers ?? {};
  }
  return {
    ...(headers ?? {}),
    "x-test-user-id": activeTestUserId
  };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...withTestUserHeader(options?.headers)
    },
    cache: "no-store"
  });
  if (!response.ok) {
    let details: unknown = undefined;
    let message = `API error: ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      details = body;
      if (Array.isArray(body.message)) {
        message = body.message.join("\n");
      } else if (typeof body.message === "string") {
        message = body.message;
      }
    } catch {
      // Keep default message when response is not JSON.
    }
    throw new ApiError(message, response.status, details);
  }
  return response.json() as Promise<T>;
}

export type CreateSourcePayload = {
  title?: string;
  resumeText: string;
  portfolioText: string;
  projectDescriptions: string[];
  targetJobPostingText: string;
  testUserId?: string;
};

export async function createSource(payload: CreateSourcePayload) {
  return request<{ id: number }>("/source-documents", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function runAnalysis(applicationId: number, force = false) {
  return request("/analysis/run", {
    method: "POST",
    body: JSON.stringify({ applicationId, force })
  });
}

export async function submitFollowup(
  applicationId: number,
  answers: Array<{ questionId: string; answer: string }>,
  force = false
) {
  return request("/followup-questions/submit", {
    method: "POST",
    body: JSON.stringify({ applicationId: String(applicationId), answers, force })
  });
}

export async function generateDocuments(applicationId: number, rewriteForJob = true, force = false) {
  return request("/generated-documents/generate", {
    method: "POST",
    body: JSON.stringify({ applicationId: String(applicationId), rewriteForJob, force })
  });
}

export async function generateInterview(applicationId: number, force = false) {
  return request("/interview/generate", {
    method: "POST",
    body: JSON.stringify({ applicationId: String(applicationId), force })
  });
}

export async function fetchApplication(applicationId: number) {
  return request(`/source-documents/${applicationId}`);
}

export type UpdateApplicationSourcesPayload = {
  resumeText: string;
  portfolioText: string;
  projectDescriptions: string[];
  targetJobPostingText: string;
};

export async function updateApplicationSources(applicationId: number, payload: UpdateApplicationSourcesPayload) {
  return request(`/source-documents/${applicationId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export type UpdateWorkflowMetaPayload = {
  title?: string;
  interviewNotesJson?: Record<string, string>;
};

export async function updateWorkflowMeta(applicationId: number, payload: UpdateWorkflowMetaPayload) {
  return request(`/source-documents/${applicationId}/meta`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function createTestUser() {
  return request<{ id: string }>("/source-documents/test-user", {
    method: "POST"
  });
}

export type SavedWorkflowItem = {
  id: number;
  title?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  targetJobPostingText: string;
  fitAnalysisJson?: { computedAt?: string; estimatedFitScore?: number } | null;
  /** 문서 초안(자소서·경력·프로젝트 중 하나라도 생성됨) */
  hasDocumentDraft?: boolean;
  /** 면접 대비 리포트 또는 예상 질문 목록이 있음 → 결과 보기 구간으로 분류 */
  hasInterviewPrep?: boolean;
};

export async function listMyWorkflows(testUserId: string) {
  return request<{ id: string; applications: SavedWorkflowItem[] }>(
    `/source-documents/by-test-user/${encodeURIComponent(testUserId)}`,
    {
      headers: withTestUserHeader()
    }
  );
}

export async function linkMyWorkflow(applicationId: number) {
  return request(`/source-documents/${applicationId}/link-my-workflow`, {
    method: "POST"
  });
}
