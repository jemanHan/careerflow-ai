const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/v1";

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
    throw new Error(`API error: ${response.status}`);
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

export async function runAnalysis(applicationId: number) {
  return request("/analysis/run", {
    method: "POST",
    body: JSON.stringify({ applicationId })
  });
}

export async function submitFollowup(applicationId: number, answers: Array<{ questionId: string; answer: string }>) {
  return request("/followup-questions/submit", {
    method: "POST",
    body: JSON.stringify({ applicationId: String(applicationId), answers })
  });
}

export async function generateDocuments(applicationId: number, rewriteForJob = true) {
  return request("/generated-documents/generate", {
    method: "POST",
    body: JSON.stringify({ applicationId: String(applicationId), rewriteForJob })
  });
}

export async function generateInterview(applicationId: number) {
  return request("/interview/generate", {
    method: "POST",
    body: JSON.stringify({ applicationId: String(applicationId) })
  });
}

export async function fetchApplication(applicationId: number) {
  return request(`/source-documents/${applicationId}`);
}
