const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/v1";

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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
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
  resumeText: string;
  portfolioText: string;
  projectDescriptions: string[];
  targetJobPostingText: string;
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
