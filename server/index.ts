import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";
import path from "node:path";
import type {
  ApiEnvelope,
  ContactMethod,
  ContactType,
  DiscoverJobsResponse,
  DiscoverPeopleResponse,
  DiscoveredPerson,
  DraftOutreachRequest,
  JobOpportunity,
  OutreachChannel,
  OutreachDraft,
  ParsedProfile,
  RankTrustPathsResponse,
  RefineOutreachRequest,
  RefineOutreachResponse
} from "../src/types/api";

type ExaResult = { title?: string; url?: string; text?: string; snippet?: string };

dotenv.config();

const app = express();
const port = Number(process.env.PORT || process.env.API_PORT || 8890);
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const openaiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
const distPath = path.resolve(process.cwd(), "dist");

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
  if (error instanceof SyntaxError) {
    fail(response, 400, "Request body must be valid JSON.");
    return;
  }
  next(error);
});

function envelope<T>(data: T, reason?: string): ApiEnvelope<T> {
  return { data, reason };
}

function fail(response: express.Response, status: number, message: string) {
  response.status(status).json({ error: message });
}

function requireOpenAI() {
  if (!openai) throw new Error("Missing OPENAI_API_KEY. Add it to .env before using live mode.");
  return openai;
}

function requireExaKey() {
  if (!process.env.EXA_API_KEY) throw new Error("Missing EXA_API_KEY. Add it to .env before using live discovery.");
  return process.env.EXA_API_KEY;
}

function stableId(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function clampScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 50;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function asStringArray(value: unknown, defaultItems: string[] = []) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return defaultItems;
}

function normalizeContactType(value: unknown, title = ""): ContactType {
  const text = `${String(value ?? "")} ${title}`.toLowerCase();
  if (text.includes("mentor") || text.includes("advisor")) return "mentor";
  if (
    text.includes("manager") ||
    text.includes("director") ||
    text.includes("head") ||
    text.includes("lead") ||
    text.includes("founder") ||
    text.includes("cto")
  ) {
    return "hiring_manager";
  }
  return "colleague";
}

function normalizeUrl(url: string) {
  const parsed = httpUrl(url);
  return parsed ? parsed.replace(/[?#].*$/, "") : "";
}

function httpUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function isLinkedInProfileUrl(url: string) {
  return /^https?:\/\/([^/]+\.)?linkedin\.com\/in\//i.test(url);
}

function extractPublicEmail(text: string) {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (!match) return undefined;
  const email = match[0].replace(/[),.;:]+$/, "");
  const lower = email.toLowerCase();
  if (lower.includes("example.") || lower.startsWith("noreply@") || lower.startsWith("no-reply@")) return undefined;
  return email;
}

function outreachChannelInstruction(channel: OutreachChannel | undefined) {
  if (channel === "email") {
    return "The draft is a concise professional email. Include a clear subject. The message should be 90-140 words.";
  }
  if (channel === "linkedin_followup") {
    return "The draft is a LinkedIn follow-up after the person accepts or replies. Keep it warm, specific, and under 700 characters.";
  }
  return "The draft is a LinkedIn connection note. Keep it under 280 characters and do not include a subject in the message body.";
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Model did not return JSON.");
    return JSON.parse(match[0]);
  }
}

async function askJson<T>(system: string, user: string, timeout = 30_000): Promise<T> {
  const client = requireOpenAI();
  const completion = await client.chat.completions.create(
    {
      model: openaiModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    },
    { timeout }
  );

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response.");
  return extractJson(content) as T;
}

async function searchExa(query: string, numResults: number, includeDomains: string[]) {
  const exaKey = requireExaKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const exaResponse = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": exaKey
      },
      signal: controller.signal,
      body: JSON.stringify({
        query,
        type: "auto",
        numResults,
        includeDomains,
        contents: { text: true }
      })
    });

    if (!exaResponse.ok) {
      const body = await exaResponse.text();
      throw new Error(`Exa search failed with ${exaResponse.status}: ${body.slice(0, 240)}`);
    }

    const payload = (await exaResponse.json()) as { results?: ExaResult[] };
    return payload.results ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

async function normalizeExaJobs(
  searchFocus: string,
  parsedProfile: ParsedProfile,
  rawResults: ExaResult[]
): Promise<DiscoverJobsResponse> {
  const raw = rawResults.slice(0, 10).map((result, index) => ({
    index,
    title: result.title || "",
    url: result.url || "",
    snippet: (result.snippet || result.text || "").replace(/\s+/g, " ").trim().slice(0, 900)
  }));
  const rawByIndex = new Map<number, (typeof raw)[number]>();
  const rawByUrl = new Map<string, (typeof raw)[number]>();
  for (const result of raw) {
    rawByIndex.set(result.index, result);
    const normalizedUrl = normalizeUrl(result.url);
    if (normalizedUrl) rawByUrl.set(normalizedUrl, result);
  }

  const normalized = await askJson<DiscoverJobsResponse>(
    [
      "You convert real Exa public search results into ranked job opportunities for a career opportunity mapper.",
      "Use only the provided Exa result titles, URLs, and snippets plus the parsed profile. Do not invent companies, job titles, salaries, requirements, or availability.",
      "Keep only results that look like real job, role, fellowship, contract, startup, or talent opportunity pages.",
      "Rank jobs from best to worst fit for the parsed profile.",
      "Return only valid JSON: {\"jobs\":[...]}.",
      "Each job must have id, sourceIndex, title, company, location, url, source, snippet, fitScore, seniority, whyThisJob, matchSignals, concerns.",
      "sourceIndex must be the rawResults index for the exact source result. url must be copied exactly from rawResults[sourceIndex]. Do not synthesize job URLs.",
      "source must be \"exa\". fitScore must be 0-100. matchSignals and concerns must be short strings grounded in the provided result/profile."
    ].join(" "),
    JSON.stringify({ searchFocus, parsedProfile, rawResults: raw }, null, 2),
    35_000
  );

  return {
    jobs: normalized.jobs
      .map<JobOpportunity | null>((job, index) => {
        const sourceIndex = Number((job as JobOpportunity & { sourceIndex?: unknown; rawIndex?: unknown }).sourceIndex ?? undefined);
        const sourceByIndex = Number.isInteger(sourceIndex) ? rawByIndex.get(sourceIndex) : undefined;
        const sourceByUrl = rawByUrl.get(normalizeUrl(job.url));
        const source = sourceByIndex || sourceByUrl || raw[index];
        const sourceUrl = httpUrl(source?.url);
        if (!job.title || !sourceUrl) return null;

        return {
          id: job.id || stableId(sourceUrl || `${job.company}-${job.title}-${index}`),
          title: job.title,
          company: job.company || "Unknown organization",
          location: job.location || "Location not returned",
          url: sourceUrl,
          source: "exa" as const,
          snippet: job.snippet || source?.snippet || "Public job result returned by Exa.",
          fitScore: clampScore(job.fitScore),
          seniority: job.seniority || "Seniority not returned",
          whyThisJob: job.whyThisJob || "Relevant to the parsed profile based on public job data.",
          matchSignals: asStringArray(job.matchSignals, ["public job match"]).slice(0, 5),
          concerns: asStringArray(job.concerns, ["Validate the role details on the source page."]).slice(0, 4)
        };
      })
      .filter((job): job is JobOpportunity => job !== null)
      .sort((a, b) => b.fitScore - a.fitScore)
  };
}

async function normalizeExaPeople(
  selectedJob: JobOpportunity,
  parsedProfile: ParsedProfile,
  rawResults: ExaResult[]
): Promise<DiscoverPeopleResponse> {
  const raw = rawResults.slice(0, 10).map((result, index) => ({
    index,
    title: result.title || "",
    url: result.url || "",
    publicEmail: extractPublicEmail(`${result.title || ""} ${result.snippet || ""} ${result.text || ""}`),
    snippet: (result.snippet || result.text || "").replace(/\s+/g, " ").trim().slice(0, 900)
  }));
  const rawByIndex = new Map<number, (typeof raw)[number]>();
  const rawByUrl = new Map<string, (typeof raw)[number]>();
  for (const result of raw) {
    rawByIndex.set(result.index, result);
    const normalizedUrl = normalizeUrl(result.url);
    if (normalizedUrl) rawByUrl.set(normalizedUrl, result);
  }

  const normalized = await askJson<DiscoverPeopleResponse>(
    [
      "You convert real Exa public search results into people to talk to for a selected job opportunity.",
      "Use only the provided Exa result titles, URLs, and snippets. Do not invent employers, titles, or relationships.",
      "Return only three contact categories: hiring managers, mentors, and colleagues currently or previously close to the selected company or role.",
      "Prefer hiring managers, team leads, directors, heads, founders, senior ICs who can mentor, and employees doing similar work.",
      "If a result is not clearly a person but still useful, keep it only if it is directly relevant and make the name the public page title.",
      "Return only valid JSON: {\"results\":[...]}.",
      "Each result must have id, sourceIndex, name, title, company, url, profileUrl, linkedinUrl, publicEmail, contactMethods, source, contactType, snippet, signals, whyTalk.",
      "sourceIndex must be the rawResults index for the exact public source result. url/profileUrl/linkedinUrl may only be copied from rawResults[sourceIndex]. Do not synthesize LinkedIn or profile URLs.",
      "source must be \"exa\". contactType must be one of hiring_manager, mentor, colleague.",
      "publicEmail must be null/omitted unless the raw Exa result explicitly includes that email. Do not infer or guess email formats.",
      "signals and whyTalk must be grounded in the public result and selected job."
    ].join(" "),
    JSON.stringify({ selectedJob, parsedProfile, rawResults: raw }, null, 2),
    25_000
  );

  return {
    results: normalized.results
      .map<DiscoveredPerson | null>((person, index) => {
        const sourceIndex = Number((person as DiscoveredPerson & { sourceIndex?: unknown; rawIndex?: unknown }).sourceIndex ?? undefined);
        const sourceByIndex = Number.isInteger(sourceIndex) ? rawByIndex.get(sourceIndex) : undefined;
        const sourceByUrl =
          rawByUrl.get(normalizeUrl(person.url)) ||
          rawByUrl.get(normalizeUrl(person.profileUrl)) ||
          rawByUrl.get(normalizeUrl(person.linkedinUrl || ""));
        const source = sourceByIndex || sourceByUrl || raw[index];
        const profileUrl = httpUrl(source?.url);
        if (!person.name || !profileUrl) return null;

        const linkedinUrl = isLinkedInProfileUrl(profileUrl) ? profileUrl : undefined;
        const publicEmail = source?.publicEmail;
        const contactMethods: ContactMethod[] = [
          linkedinUrl ? "linkedin" : "profile",
          ...(publicEmail ? (["email"] as ContactMethod[]) : [])
        ];

        return {
          id: person.id || stableId(profileUrl || `${person.name}-${index}`),
          name: person.name,
          title: person.title || "Public result related to the selected job",
          company: person.company || selectedJob.company,
          url: profileUrl,
          profileUrl,
          linkedinUrl,
          publicEmail,
          contactMethods,
          source: "exa" as const,
          contactType: normalizeContactType(person.contactType, `${person.title} ${person.snippet}`),
          snippet: person.snippet || "Public result related to the selected job.",
          signals: asStringArray(person.signals, ["public result", "job relevance"]).slice(0, 5),
          whyTalk: person.whyTalk || "Public profile appears relevant to the selected job or company."
        };
      })
      .filter((person): person is DiscoveredPerson => person !== null)
  };
}

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    service: "zo-relationship-mapper",
    mode: "live",
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    exaConfigured: Boolean(process.env.EXA_API_KEY)
  });
});

app.post("/api/profile/parse", async (request, response) => {
  const profileText = String(request.body?.profileText ?? "").trim();
  if (!profileText) {
    fail(response, 400, "Paste a real resume or profile before parsing.");
    return;
  }

  try {
    const parsed = await askJson<ParsedProfile>(
      [
        "You parse real career profiles into structured JSON for an opportunity trust-path mapper.",
        "Return only valid JSON with exactly these keys: careerSummary, companies, roles, skills, domains, proofOfWork.",
        "All array values must be grounded in the supplied profile text. Do not invent employers, projects, communities, or skills.",
        "If a field is unknown, return an empty array for that field."
      ].join(" "),
      `Parse this real profile for opportunity trust-path mapping:\n\n${profileText}`
    );
    response.json(envelope(parsed));
  } catch (error) {
    fail(response, 502, error instanceof Error ? error.message : "OpenAI profile parsing failed.");
  }
});

app.post("/api/jobs/discover", async (request, response) => {
  const searchFocus = String(request.body?.searchFocus ?? "").trim();
  const parsedProfile = request.body?.parsedProfile as ParsedProfile | undefined;

  if (!parsedProfile) {
    fail(response, 400, "Parse a real profile before discovering jobs.");
    return;
  }

  const endpointTimeout = setTimeout(() => {
    if (!response.headersSent) {
      fail(response, 504, "Live job discovery timed out while calling Exa/OpenAI. Try a narrower job search focus.");
    }
  }, 70_000);

  try {
    const query = [
      searchFocus || "Singapore remote",
      "job opening hiring careers role apply",
      asStringArray(parsedProfile.roles).slice(0, 4).join(" "),
      asStringArray(parsedProfile.domains).slice(0, 4).join(" "),
      asStringArray(parsedProfile.skills).slice(0, 7).join(" ")
    ]
      .filter(Boolean)
      .join(" ");

    const rawResults = await searchExa(query, 12, [
      "linkedin.com",
      "greenhouse.io",
      "lever.co",
      "wellfound.com",
      "workable.com",
      "mycareersfuture.gov.sg",
      "ashbyhq.com",
      "workdayjobs.com",
      "smartrecruiters.com"
    ]);

    if (!rawResults.length) {
      if (!response.headersSent) {
        response.json(envelope<DiscoverJobsResponse>({ jobs: [] }, "Exa returned no public job results."));
      }
      return;
    }

    const normalized = await normalizeExaJobs(searchFocus, parsedProfile, rawResults);
    if (!response.headersSent) response.json(envelope(normalized));
  } catch (error) {
    if (!response.headersSent) {
      fail(response, 502, error instanceof Error ? error.message : "Live job discovery failed.");
    }
  } finally {
    clearTimeout(endpointTimeout);
  }
});

app.post("/api/people/discover", async (request, response) => {
  const selectedJob = request.body?.selectedJob as JobOpportunity | undefined;
  const parsedProfile = request.body?.parsedProfile as ParsedProfile | undefined;

  if (!selectedJob) {
    fail(response, 400, "Select a real job before discovering people to talk to.");
    return;
  }
  if (!parsedProfile) {
    fail(response, 400, "Parse a real profile before discovering people.");
    return;
  }

  const endpointTimeout = setTimeout(() => {
    if (!response.headersSent) {
      fail(response, 504, "Live people discovery timed out while calling Exa/OpenAI. Try a narrower job.");
    }
  }, 60_000);

  try {
    const query = [
      "site:linkedin.com/in",
      selectedJob.company,
      selectedJob.title,
      "hiring manager engineering manager product manager team lead director founder mentor staff engineer senior engineer colleague",
      asStringArray(parsedProfile.domains).slice(0, 4).join(" "),
      asStringArray(parsedProfile.skills).slice(0, 6).join(" ")
    ]
      .filter(Boolean)
      .join(" ");

    const rawResults = await searchExa(query, 10, ["linkedin.com", "wellfound.com", "crunchbase.com"]);
    if (!rawResults.length) {
      if (!response.headersSent) {
        response.json(envelope<DiscoverPeopleResponse>({ results: [] }, "Exa returned no public people results."));
      }
      return;
    }

    const normalized = await normalizeExaPeople(selectedJob, parsedProfile, rawResults);
    if (!response.headersSent) response.json(envelope(normalized));
  } catch (error) {
    if (!response.headersSent) {
      fail(response, 502, error instanceof Error ? error.message : "Live people discovery failed.");
    }
  } finally {
    clearTimeout(endpointTimeout);
  }
});

app.post("/api/trust-paths/rank", async (request, response) => {
  const selectedJob = request.body?.selectedJob as JobOpportunity | undefined;
  const parsedProfile = request.body?.parsedProfile as ParsedProfile | undefined;
  const discoveredPeople = (request.body?.discoveredPeople ?? []) as DiscoveredPerson[];

  if (!selectedJob || !parsedProfile || !discoveredPeople.length) {
    fail(response, 400, "Selected job, parsed profile, and real discovered people are required before ranking.");
    return;
  }

  try {
    const ranked = await askJson<RankTrustPathsResponse>(
      [
        "You rank real opportunity trust paths for a selected job using only the provided profile, selected job, and discovered public people.",
        "Return only valid JSON with a paths array.",
        "Each path needs: id, personName, role, company, score 0-100, confidence high/medium/low, trustReason, suggestedAsk, risks array, sourceUrl.",
        "Prioritize people who are likely to help the candidate understand the role, hiring context, team, or company.",
        "Do not invent a direct relationship. If public data is weak, lower confidence and explain the risk."
      ].join(" "),
      JSON.stringify({ selectedJob, parsedProfile, discoveredPeople }, null, 2),
      35_000
    );
    response.json(envelope(ranked));
  } catch (error) {
    fail(response, 502, error instanceof Error ? error.message : "OpenAI trust-path ranking failed.");
  }
});

app.post("/api/outreach/draft", async (request, response) => {
  const body = request.body as DraftOutreachRequest;
  if (!body?.selectedJob || !body?.selectedPath) {
    fail(response, 400, "Selected job and selected real trust path are required before drafting outreach.");
    return;
  }
  if (body.channel === "email" && !body.selectedPerson?.publicEmail) {
    fail(response, 400, "A public email is required before drafting an email follow-up.");
    return;
  }

  try {
    const channel = body.channel || "linkedin_invite";
    const draft = await askJson<OutreachDraft>(
      [
        "You draft warm professional outreach from real user, selected job, and public contact context.",
        "Return only valid JSON with subject, message, followUp.",
        outreachChannelInstruction(channel),
        "The message must be concise, contextual to the selected job, non-desperate, and must not imply a relationship that was not provided.",
        "Do not ask for a referral too early."
      ].join(" "),
      JSON.stringify(body, null, 2),
      30_000
    );
    response.json(envelope(draft));
  } catch (error) {
    fail(response, 502, error instanceof Error ? error.message : "OpenAI outreach drafting failed.");
  }
});

app.post("/api/outreach/refine", async (request, response) => {
  const body = request.body as RefineOutreachRequest;
  const instruction = String(body?.instruction ?? "").trim();
  if (!body?.selectedJob || !body?.selectedPath || !body?.currentDraft || !instruction) {
    fail(response, 400, "Selected job, selected trust path, current draft, and chat instruction are required before refining outreach.");
    return;
  }
  if (body.channel === "email" && !body.selectedPerson?.publicEmail) {
    fail(response, 400, "A public email is required before refining an email follow-up.");
    return;
  }

  try {
    const recentMessages = (body.messages || [])
      .filter((message) => message.content?.trim())
      .slice(-8);
    const refined = await askJson<RefineOutreachResponse>(
      [
        "You are an outreach editor inside a job relationship mapper.",
        "Revise the current outreach draft based on the user's latest chat instruction and recent chat context.",
        "Return only valid JSON with reply and draft.",
        "draft must include subject, message, followUp.",
        outreachChannelInstruction(body.channel),
        "Use only the provided profile, selected job, selected public contact/path, current draft, and chat messages.",
        "Do not invent relationships, private contact details, insider knowledge, referrals, or claims not provided.",
        "The reply should briefly state what changed, without extra formatting."
      ].join(" "),
      JSON.stringify(
        {
          selectedJob: body.selectedJob,
          selectedPath: body.selectedPath,
          selectedPerson: body.selectedPerson,
          parsedProfile: body.parsedProfile,
          currentDraft: body.currentDraft,
          messages: recentMessages,
          instruction,
          channel: body.channel || "linkedin_invite"
        },
        null,
        2
      ),
      30_000
    );
    response.json(envelope(refined));
  } catch (error) {
    fail(response, 502, error instanceof Error ? error.message : "OpenAI outreach refinement failed.");
  }
});

app.use(express.static(distPath));

app.get(/^\/(?!api(?:\/|$)).*/, (_request, response) => {
  response.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`Zo Relationship Mapper running on http://localhost:${port}`);
});
