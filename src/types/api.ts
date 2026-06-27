export type Confidence = "high" | "medium" | "low";
export type ContactType = "hiring_manager" | "mentor" | "colleague";

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

export interface JobOpportunity {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  source: "exa";
  snippet: string;
  fitScore: number;
  seniority: string;
  whyThisJob: string;
  matchSignals: string[];
  concerns: string[];
}

export interface DiscoveredPerson {
  id: string;
  name: string;
  title: string;
  company: string;
  url: string;
  source: "exa";
  contactType: ContactType;
  snippet: string;
  signals: string[];
  whyTalk: string;
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

export interface ApiEnvelope<T> {
  data: T;
  reason?: string;
}

export interface ParseProfileRequest {
  profileText: string;
}

export interface DiscoverJobsRequest {
  parsedProfile: ParsedProfile;
  searchFocus?: string;
}

export interface DiscoverJobsResponse {
  jobs: JobOpportunity[];
}

export interface DiscoverPeopleRequest {
  parsedProfile: ParsedProfile;
  selectedJob: JobOpportunity;
}

export interface DiscoverPeopleResponse {
  results: DiscoveredPerson[];
}

export interface RankTrustPathsRequest {
  selectedJob: JobOpportunity;
  parsedProfile: ParsedProfile;
  discoveredPeople: DiscoveredPerson[];
}

export interface RankTrustPathsResponse {
  paths: TrustPath[];
}

export interface DraftOutreachRequest {
  selectedJob: JobOpportunity;
  selectedPath: TrustPath;
  parsedProfile?: ParsedProfile;
  tone?: string;
}
