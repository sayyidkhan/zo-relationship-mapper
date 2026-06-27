export type Confidence = "high" | "medium" | "low";

export type OutcomeState =
  | "not_contacted"
  | "contacted"
  | "replied"
  | "referral"
  | "dead_end";

export interface ParsedProfile {
  careerSummary: string;
  companies: string[];
  roles: string[];
  skills: string[];
  domains: string[];
  proofOfWork: string[];
}

export interface DiscoveredPerson {
  id: string;
  name: string;
  title: string;
  company: string;
  url: string;
  source: "exa" | "seed";
  snippet: string;
  signals: string[];
}

export interface TrustPath {
  id: string;
  personName: string;
  role: string;
  company: string;
  score: number;
  confidence: Confidence;
  trustReason: string;
  suggestedAsk: string;
  risks: string[];
  sourceUrl?: string;
}

export interface OutreachDraft {
  subject: string;
  message: string;
  followUp: string;
}

export interface SeedDemo {
  profileText: string;
  target: string;
  parsedProfile: ParsedProfile;
  discoveredPeople: DiscoveredPerson[];
  rankedPaths: TrustPath[];
  outreachDraft: OutreachDraft;
}

export interface ApiEnvelope<T> {
  data: T;
  fallbackUsed: boolean;
  reason?: string;
}

export interface ParseProfileRequest {
  profileText: string;
}

export interface DiscoverTargetsRequest {
  target: string;
  parsedProfile: ParsedProfile;
}

export interface DiscoverTargetsResponse {
  results: DiscoveredPerson[];
}

export interface RankTrustPathsRequest {
  target: string;
  parsedProfile: ParsedProfile;
  discoveredPeople: DiscoveredPerson[];
}

export interface RankTrustPathsResponse {
  paths: TrustPath[];
}

export interface DraftOutreachRequest {
  target: string;
  selectedPath: TrustPath;
  parsedProfile?: ParsedProfile;
  tone?: string;
}
