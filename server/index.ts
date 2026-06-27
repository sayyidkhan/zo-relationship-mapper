import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";
import type {
  ApiEnvelope,
  DiscoverTargetsResponse,
  DiscoveredPerson,
  DraftOutreachRequest,
  OutreachDraft,
  ParsedProfile,
  RankTrustPathsResponse
} from "../src/types/api";

dotenv.config();

const app = express();
const port = Number(process.env.API_PORT || 8890);
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const openaiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";

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

function normalizeExaResult(
  result: { title?: string; url?: string; text?: string; snippet?: string },
  index: number,
  target: string
): DiscoveredPerson {
  const title = result.title?.replace(/\s+\|\s+LinkedIn.*$/i, "").trim() || `Public profile ${index + 1}`;
  const parts = title.split(/\s[-|–]\s/).map((part) => part.trim()).filter(Boolean);
  const name = parts[0] || title;
  const role = parts[1] || "Public profile related to target";
  const snippet = (result.snippet || result.text || "Public result related to the target.").replace(/\s+/g, " ").trim();

  return {
    id: stableId(result.url || `${title}-${index}`),
    name,
    title: role,
    company: target,
    url: result.url || "#",
    source: "exa",
    snippet: snippet.slice(0, 320),
    signals: ["public result", "target relevance", "Exa discovery"]
  };
}

async function normalizeExaPeople(
  target: string,
  parsedProfile: ParsedProfile,
  rawResults: Array<{ title?: string; url?: string; text?: string; snippet?: string }>
): Promise<DiscoverTargetsResponse> {
  const raw = rawResults.slice(0, 10).map((result, index) => ({
    index,
    title: result.title || "",
    url: result.url || "",
    snippet: (result.snippet || result.text || "").replace(/\s+/g, " ").trim().slice(0, 900)
  }));

  const normalized = await askJson<DiscoverTargetsResponse>(
    [
      "You convert real Exa public search results into clean people/company discovery rows for a trust-path mapper.",
      "Use only the provided Exa result titles, URLs, and snippets. Do not invent employers, titles, or relationships.",
      "Prefer individual people, hiring managers, founders, recruiters, engineering/product leaders, or community operators.",
      "If a result is not clearly a person but still useful, keep it only if it is directly relevant and make the name the public page title.",
      "Return only valid JSON: {\"results\":[...]}.",
      "Each result must have id, name, title, company, url, source, snippet, signals.",
      "source must be \"exa\". signals must be short strings grounded in the public result."
    ].join(" "),
    JSON.stringify({ target, parsedProfile, rawResults: raw }, null, 2),
    25_000
  );

  return {
    results: normalized.results
      .filter((person) => person.name && person.url)
      .map((person, index) => ({
        id: person.id || stableId(person.url || `${person.name}-${index}`),
        name: person.name,
        title: person.title || "Public result related to target",
        company: person.company || "Unknown organization",
        url: person.url,
        source: "exa",
        snippet: person.snippet || "Public result related to the target.",
        signals: person.signals?.length ? person.signals.slice(0, 5) : ["public result", "target relevance"]
      }))
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

app.post("/api/targets/discover", async (request, response) => {
  const target = String(request.body?.target ?? "").trim();
  const parsedProfile = request.body?.parsedProfile as ParsedProfile | undefined;

  if (!target) {
    fail(response, 400, "Enter a real target role, company, person, or opportunity before discovery.");
    return;
  }
  if (!parsedProfile) {
    fail(response, 400, "Parse a real profile before running discovery.");
    return;
  }

  const endpointTimeout = setTimeout(() => {
    if (!response.headersSent) {
      fail(response, 504, "Live discovery timed out while calling Exa/OpenAI. Try a narrower target.");
    }
  }, 55_000);

  try {
    const exaKey = requireExaKey();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const query = [
      "site:linkedin.com/in",
      target,
      "hiring manager recruiter founder engineering product AI climate sustainability Singapore",
      parsedProfile.domains?.slice(0, 4).join(" "),
      parsedProfile.skills?.slice(0, 5).join(" ")
    ]
      .filter(Boolean)
      .join(" ");

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
        numResults: 8,
        includeDomains: ["linkedin.com", "wellfound.com", "crunchbase.com"],
        contents: { text: true }
      })
    });
    clearTimeout(timeout);

    if (!exaResponse.ok) {
      const body = await exaResponse.text();
      throw new Error(`Exa search failed with ${exaResponse.status}: ${body.slice(0, 240)}`);
    }

    const payload = (await exaResponse.json()) as {
      results?: Array<{ title?: string; url?: string; text?: string; snippet?: string }>;
    };

    const rawResults = payload.results ?? [];
    if (!rawResults.length) {
      if (!response.headersSent) {
        response.json(envelope<DiscoverTargetsResponse>({ results: [] }, "Exa returned no public results."));
      }
      return;
    }

    try {
      const normalized = await normalizeExaPeople(target, parsedProfile, rawResults);
      if (!response.headersSent) response.json(envelope(normalized));
    } catch {
      const results = rawResults.map((result, index) => normalizeExaResult(result, index, target));
      if (!response.headersSent) {
        response.json(envelope<DiscoverTargetsResponse>({ results }, "Used raw Exa result normalization."));
      }
    }
  } catch (error) {
    if (!response.headersSent) {
      fail(response, 502, error instanceof Error ? error.message : "Exa discovery failed.");
    }
  } finally {
    clearTimeout(endpointTimeout);
  }
});

app.post("/api/trust-paths/rank", async (request, response) => {
  const target = String(request.body?.target ?? "").trim();
  const parsedProfile = request.body?.parsedProfile as ParsedProfile | undefined;
  const discoveredPeople = (request.body?.discoveredPeople ?? []) as DiscoveredPerson[];

  if (!target || !parsedProfile || !discoveredPeople.length) {
    fail(response, 400, "Target, parsed profile, and real discovered people are required before ranking.");
    return;
  }

  try {
    const ranked = await askJson<RankTrustPathsResponse>(
      [
        "You rank real opportunity trust paths using only the provided profile and discovered public people.",
        "Return only valid JSON with a paths array.",
        "Each path needs: id, personName, role, company, score 0-100, confidence high/medium/low, trustReason, suggestedAsk, risks array, sourceUrl.",
        "Do not invent a direct relationship. If public data is weak, lower confidence and explain the risk."
      ].join(" "),
      JSON.stringify({ target, parsedProfile, discoveredPeople }, null, 2),
      35_000
    );
    response.json(envelope(ranked));
  } catch (error) {
    fail(response, 502, error instanceof Error ? error.message : "OpenAI trust-path ranking failed.");
  }
});

app.post("/api/outreach/draft", async (request, response) => {
  const body = request.body as DraftOutreachRequest;
  if (!body?.target || !body?.selectedPath) {
    fail(response, 400, "Target and selected real trust path are required before drafting outreach.");
    return;
  }

  try {
    const draft = await askJson<OutreachDraft>(
      [
        "You draft warm professional outreach from real user and public target context.",
        "Return only valid JSON with subject, message, followUp.",
        "The message must be concise, contextual, non-desperate, and must not imply a relationship that was not provided.",
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

app.listen(port, () => {
  console.log(`Zo Relationship Mapper live API running on http://localhost:${port}`);
});
