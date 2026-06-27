import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";
import { seedDemo } from "../src/data/demo";
import type {
  ApiEnvelope,
  Confidence,
  DiscoverTargetsResponse,
  DiscoveredPerson,
  DraftOutreachRequest,
  OutreachDraft,
  ParsedProfile,
  RankTrustPathsResponse,
  TrustPath
} from "../src/types/api";

dotenv.config();

const app = express();
const port = Number(process.env.API_PORT || 8890);
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const openaiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
const forceDemoMode = process.env.FORCE_DEMO_MODE === "true";

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function envelope<T>(data: T, fallbackUsed = false, reason?: string): ApiEnvelope<T> {
  return { data, fallbackUsed, reason };
}

function clampScore(score: number): number {
  if (Number.isNaN(score)) return 70;
  return Math.max(0, Math.min(100, Math.round(score)));
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

async function askJson<T>(system: string, user: string): Promise<T> {
  if (forceDemoMode) throw new Error("FORCE_DEMO_MODE is enabled");
  if (!openai) throw new Error("Missing OPENAI_API_KEY");

  const completion = await openai.chat.completions.create({
    model: openaiModel,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  }, {
    timeout: 12_000
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");
  return extractJson(content) as T;
}

function heuristicProfile(profileText: string): ParsedProfile {
  const text = profileText.trim();
  if (text.length < 80) return seedDemo.parsedProfile;

  const knownCompanies = ["Sembcorp", "UBS", "DBS", "NCS", "Google", "Meta", "Microsoft", "Amazon", "Stripe"];
  const knownSkills = [
    "TypeScript",
    "JavaScript",
    "React",
    "Node",
    "Python",
    "Java",
    "Go",
    "Golang",
    "OpenAI",
    "AI agents",
    "LLM",
    "Automation",
    "SaaS",
    "AWS",
    "Azure"
  ];

  const companies = knownCompanies.filter((company) => text.toLowerCase().includes(company.toLowerCase()));
  const skills = knownSkills.filter((skill) => text.toLowerCase().includes(skill.toLowerCase()));
  const proofOfWork = text
    .split(/\n|\. /)
    .map((line) => line.trim())
    .filter((line) => /built|launched|hackathon|project|delivered|created|engineer|developer/i.test(line))
    .slice(0, 6);

  return {
    careerSummary:
      text.slice(0, 260) +
      (text.length > 260 ? "..." : "") +
      " This profile has enough career context to map opportunity-specific trust signals.",
    companies: companies.length ? companies : seedDemo.parsedProfile.companies,
    roles: seedDemo.parsedProfile.roles,
    skills: skills.length ? skills : seedDemo.parsedProfile.skills,
    domains: seedDemo.parsedProfile.domains,
    proofOfWork: proofOfWork.length ? proofOfWork : seedDemo.parsedProfile.proofOfWork
  };
}

function fallbackDiscovery(target: string): DiscoverTargetsResponse {
  const targetWords = target.toLowerCase();
  const people = seedDemo.discoveredPeople.map((person) => ({
    ...person,
    signals: [
      ...new Set([
        ...person.signals,
        targetWords.includes("startup") ? "startup relevance" : "target relevance",
        targetWords.includes("climate") || targetWords.includes("sustainability")
          ? "sustainability relevance"
          : "domain relevance"
      ])
    ]
  }));

  return { results: people };
}

function fallbackRank(
  target: string,
  parsedProfile: ParsedProfile,
  discoveredPeople: DiscoveredPerson[]
): RankTrustPathsResponse {
  const profileTerms = [
    ...parsedProfile.companies,
    ...parsedProfile.skills,
    ...parsedProfile.domains,
    ...parsedProfile.proofOfWork
  ]
    .join(" ")
    .toLowerCase();

  const paths: TrustPath[] = discoveredPeople
    .map((person, index) => {
      const haystack = `${person.title} ${person.company} ${person.snippet} ${person.signals.join(" ")}`.toLowerCase();
      const signalHits = person.signals.filter((signal) => profileTerms.includes(signal.split(" ")[0].toLowerCase()));
      const hiringBoost = /hiring|manager|talent|founder|head/i.test(haystack) ? 8 : 0;
      const aiBoost = /ai|agent|automation|platform|developer|engineering/i.test(haystack) ? 7 : 0;
      const targetBoost = target
        .split(/\s+/)
        .filter((word) => word.length > 4 && haystack.includes(word.toLowerCase())).length * 2;
      const score = clampScore(64 + hiringBoost + aiBoost + targetBoost + signalHits.length * 3 - index * 4);
      const confidence: Confidence = score >= 86 ? "high" : score >= 74 ? "medium" : "low";

      return {
        id: `path-${person.id}`,
        personName: person.name,
        role: person.title,
        company: person.company,
        score,
        confidence,
        trustReason: `${person.name} is relevant because of ${person.signals
          .slice(0, 3)
          .join(", ")}. This creates a credible conversation angle for ${target}.`,
        suggestedAsk: /manager|head|talent|founder/i.test(person.title)
          ? "Ask for a short role-fit conversation before applying cold."
          : "Ask for advice on the right person, team, or proof-of-work to prepare before applying.",
        risks: [
          "Public signals are not proof of a real relationship",
          "Keep the message contextual and avoid asking for a referral too early"
        ],
        sourceUrl: person.url
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return { paths };
}

function fallbackDraft(body: DraftOutreachRequest): OutreachDraft {
  const { selectedPath, target } = body;
  return {
    subject: `Quick advice on ${target}`,
    message: `Hi ${selectedPath.personName.split(" ")[0]}, I noticed your work as ${selectedPath.role} at ${
      selectedPath.company
    }.\n\nI am exploring ${target} and your background stood out because ${selectedPath.trustReason.toLowerCase()}\n\nI am not looking to send a generic cold application. Would you be open to a short 15-minute conversation so I can understand what the team actually values and whether my background is relevant?\n\nHappy to share a concise proof-of-work note before the call.`,
    followUp:
      "If there is no reply after 5 business days, send one proof-of-work update and ask whether there is a better person to speak with."
  };
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "zo-relationship-mapper", fallbackReady: true });
});

app.get("/api/demo/seed", (_request, response) => {
  response.json(envelope(seedDemo, true, "Seed demo data is always available for the localhost proof of concept."));
});

app.post("/api/profile/parse", async (request, response) => {
  const profileText = String(request.body?.profileText ?? "");

  try {
    const parsed = await askJson<ParsedProfile>(
      "You parse career profiles into structured JSON for a trust-path mapper. Return only valid JSON with careerSummary, companies, roles, skills, domains, proofOfWork arrays.",
      `Parse this profile for opportunity trust-path mapping:\n\n${profileText}`
    );
    response.json(envelope(parsed));
  } catch (error) {
    response.json(
      envelope(
        heuristicProfile(profileText),
        true,
        error instanceof Error ? error.message : "Profile parsing fallback used."
      )
    );
  }
});

app.post("/api/targets/discover", async (request, response) => {
  const target = String(request.body?.target ?? seedDemo.target);
  const parsedProfile = request.body?.parsedProfile as ParsedProfile | undefined;

  if (forceDemoMode || !process.env.EXA_API_KEY) {
    response.json(
      envelope(
        fallbackDiscovery(target),
        true,
        forceDemoMode ? "FORCE_DEMO_MODE is enabled. Seed Exa-style results used." : "Missing EXA_API_KEY. Seed Exa-style results used."
      )
    );
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const query = [
      target,
      "LinkedIn hiring manager recruiter founder engineering product AI climate sustainability Singapore",
      parsedProfile?.domains?.slice(0, 4).join(" "),
      parsedProfile?.skills?.slice(0, 5).join(" ")
    ]
      .filter(Boolean)
      .join(" ");

    const exaResponse = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.EXA_API_KEY
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

    if (!exaResponse.ok) throw new Error(`Exa search failed: ${exaResponse.status}`);
    const payload = (await exaResponse.json()) as {
      results?: Array<{ title?: string; url?: string; text?: string; snippet?: string }>;
    };

    const results: DiscoveredPerson[] = (payload.results ?? []).map((result, index) => {
      const title = result.title || "Relevant public profile";
      const [namePart, rolePart] = title.split(/[-|]/).map((part) => part.trim());
      return {
        id: stableId(result.url || `${title}-${index}`),
        name: namePart || `Discovered profile ${index + 1}`,
        title: rolePart || "Public profile related to target",
        company: target.split(" at ").pop() || "Target ecosystem",
        url: result.url || "#",
        source: "exa",
        snippet: (result.snippet || result.text || "Public search result related to the target.").slice(0, 320),
        signals: ["public profile", "target relevance", "Exa discovery"]
      };
    });

    response.json(envelope({ results: results.length ? results : fallbackDiscovery(target).results }));
  } catch (error) {
    response.json(
      envelope(
        fallbackDiscovery(target),
        true,
        error instanceof Error ? error.message : "Exa fallback used."
      )
    );
  }
});

app.post("/api/trust-paths/rank", async (request, response) => {
  const target = String(request.body?.target ?? seedDemo.target);
  const parsedProfile = (request.body?.parsedProfile ?? seedDemo.parsedProfile) as ParsedProfile;
  const discoveredPeople = (request.body?.discoveredPeople ?? seedDemo.discoveredPeople) as DiscoveredPerson[];

  try {
    const ranked = await askJson<RankTrustPathsResponse>(
      "You rank opportunity trust paths. Return only valid JSON with a paths array. Each path needs id, personName, role, company, score 0-100, confidence high/medium/low, trustReason, suggestedAsk, risks array, sourceUrl.",
      JSON.stringify({ target, parsedProfile, discoveredPeople }, null, 2)
    );
    response.json(envelope(ranked));
  } catch (error) {
    response.json(
      envelope(
        fallbackRank(target, parsedProfile, discoveredPeople),
        true,
        error instanceof Error ? error.message : "Trust-path ranking fallback used."
      )
    );
  }
});

app.post("/api/outreach/draft", async (request, response) => {
  const body = request.body as DraftOutreachRequest;

  try {
    const draft = await askJson<OutreachDraft>(
      "You draft warm professional outreach. Return only valid JSON with subject, message, followUp. The message must be concise, contextual, non-desperate, and must not ask for a referral too early.",
      JSON.stringify(body, null, 2)
    );
    response.json(envelope(draft));
  } catch (error) {
    response.json(
      envelope(
        fallbackDraft(body),
        true,
        error instanceof Error ? error.message : "Outreach fallback used."
      )
    );
  }
});

app.listen(port, () => {
  console.log(`Zo Relationship Mapper API running on http://localhost:${port}`);
});
