import type {
  ApiEnvelope,
  DiscoverTargetsRequest,
  DiscoverTargetsResponse,
  DraftOutreachRequest,
  OutreachDraft,
  ParsedProfile,
  ParseProfileRequest,
  RankTrustPathsRequest,
  RankTrustPathsResponse
} from "../types/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8890";

async function request<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      message = parsed.error || text;
    } catch {
      message = text;
    }
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<ApiEnvelope<T>>;
}

export const api = {
  parseProfile: (body: ParseProfileRequest) =>
    request<ParsedProfile>("/api/profile/parse", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  discoverTargets: (body: DiscoverTargetsRequest) =>
    request<DiscoverTargetsResponse>("/api/targets/discover", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  rankTrustPaths: (body: RankTrustPathsRequest) =>
    request<RankTrustPathsResponse>("/api/trust-paths/rank", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  draftOutreach: (body: DraftOutreachRequest) =>
    request<OutreachDraft>("/api/outreach/draft", {
      method: "POST",
      body: JSON.stringify(body)
    })
};
