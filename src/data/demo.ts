import type { DiscoveredPerson, ParsedProfile, SeedDemo, TrustPath } from "../types/api";

export const demoProfileText = `Sayyid Khan
Full Stack Gen AI Developer / Agentic AI Engineer at Sembcorp.
Previously full stack software engineer across UBS and DBS, consulting at NCS Group, and freelance software engineering.
Builds with JavaScript, TypeScript, Java, Go, Python, React, Node, cloud services, LLM apps, AI agents, automation, and developer tooling.
Serial hackathon builder with 19 hackathons completed, focused on execution speed, AI agents, sustainability, fintech, developer tools, and startup ideas.
Looking to transition from builder to founder/operator and explore AI platform, product, sustainability, and venture-backed startup opportunities.`;

export const demoParsedProfile: ParsedProfile = {
  careerSummary:
    "Full-stack GenAI engineer with enterprise banking, consulting, freelance delivery, agentic AI, sustainability, and hackathon proof-of-work. Strong fit for AI platform, developer tooling, and climate/sustainability technology roles where execution speed and operator judgment matter.",
  companies: ["Sembcorp", "UBS", "DBS", "NCS Group", "Freelance"],
  roles: [
    "Full Stack Gen AI Developer",
    "Agentic AI Engineer",
    "Full Stack Software Engineer",
    "Freelance Software Engineer",
    "Consulting Engineer"
  ],
  skills: [
    "TypeScript",
    "React",
    "Node.js",
    "Java",
    "Go",
    "Python",
    "OpenAI API",
    "AI agents",
    "Automation",
    "Developer tooling"
  ],
  domains: ["AI platforms", "Sustainability", "Fintech", "Banking", "Developer tools", "Enterprise automation"],
  proofOfWork: [
    "19 hackathons completed",
    "Enterprise GenAI delivery at Sembcorp",
    "Banking engineering experience at UBS and DBS",
    "Freelance full-stack product delivery",
    "Operator/founder transition thesis"
  ]
};

export const demoTarget = "AI platform/product role at a climate tech or sustainability startup in Singapore";

export const demoDiscoveredPeople: DiscoveredPerson[] = [
  {
    id: "person-zoe-tan",
    name: "Zoe Tan",
    title: "Head of AI Products",
    company: "Gridwise Climate",
    url: "https://www.linkedin.com/in/zoe-tan-ai-products",
    source: "seed",
    snippet:
      "Product leader building AI tools for energy forecasting and commercial sustainability teams in Singapore.",
    signals: ["hiring proximity", "AI product", "sustainability domain", "Singapore operator"]
  },
  {
    id: "person-aaron-lim",
    name: "Aaron Lim",
    title: "Founding Engineer",
    company: "CarbonOps",
    url: "https://www.linkedin.com/in/aaron-lim-carbonops",
    source: "seed",
    snippet:
      "Founding engineer working on carbon accounting automation, developer workflows, and LLM-powered reporting.",
    signals: ["founding team", "developer tooling", "AI automation", "proof-of-work fit"]
  },
  {
    id: "person-maya-chen",
    name: "Maya Chen",
    title: "Talent Partner",
    company: "January Capital",
    url: "https://www.linkedin.com/in/maya-chen-startup-talent",
    source: "seed",
    snippet:
      "Talent partner supporting venture-backed AI and sustainability startups across Southeast Asia.",
    signals: ["investor network", "startup hiring", "portfolio access", "warm intro candidate"]
  },
  {
    id: "person-daniel-ong",
    name: "Daniel Ong",
    title: "Engineering Manager, AI Platforms",
    company: "VoltMesh",
    url: "https://www.linkedin.com/in/daniel-ong-ai-platforms",
    source: "seed",
    snippet:
      "Engineering manager hiring AI platform engineers with infra, backend, React, and LLM workflow experience.",
    signals: ["direct hiring proximity", "AI platforms", "engineering manager", "backend/frontend match"]
  },
  {
    id: "person-priya-nair",
    name: "Priya Nair",
    title: "Community Lead",
    company: "Build Club Singapore",
    url: "https://www.linkedin.com/in/priya-nair-build-club",
    source: "seed",
    snippet:
      "Community operator connecting builders, hackathon teams, startup founders, and AI product leaders.",
    signals: ["community bridge", "hackathon overlap", "builder credibility", "low-friction ask"]
  }
];

export const demoRankedPaths: TrustPath[] = [
  {
    id: "path-daniel-ong",
    personName: "Daniel Ong",
    role: "Engineering Manager, AI Platforms",
    company: "VoltMesh",
    score: 91,
    confidence: "high",
    trustReason:
      "Direct hiring proximity plus strong skill match: AI platforms, full-stack delivery, backend/frontend breadth, and enterprise GenAI experience.",
    suggestedAsk:
      "Ask for a 15-minute role-fit conversation before applying, anchored on AI platform execution and enterprise GenAI delivery.",
    risks: ["No explicit warm connection found from seed data", "Message must avoid sounding like a cold referral request"],
    sourceUrl: "https://www.linkedin.com/in/daniel-ong-ai-platforms"
  },
  {
    id: "path-aaron-lim",
    personName: "Aaron Lim",
    role: "Founding Engineer",
    company: "CarbonOps",
    score: 87,
    confidence: "high",
    trustReason:
      "Strong proof-of-work overlap across AI automation, developer tooling, sustainability, and startup builder energy.",
    suggestedAsk:
      "Ask for advice on what technical proof-of-work would make a climate AI platform candidate stand out.",
    risks: ["May not own hiring decisions", "Better as advice path than referral path"],
    sourceUrl: "https://www.linkedin.com/in/aaron-lim-carbonops"
  },
  {
    id: "path-priya-nair",
    personName: "Priya Nair",
    role: "Community Lead",
    company: "Build Club Singapore",
    score: 82,
    confidence: "medium",
    trustReason:
      "Hackathon and builder-community overlap creates a warmer context for asking who is hiring in AI/sustainability.",
    suggestedAsk:
      "Ask for two founder/operator suggestions in the AI climate or sustainability tooling space.",
    risks: ["Indirect path", "Requires a clear proof-of-work update to be credible"],
    sourceUrl: "https://www.linkedin.com/in/priya-nair-build-club"
  }
];

export const demoOutreachDraft = {
  subject: "Quick advice on AI platform roles in sustainability",
  message:
    "Hi Daniel, I noticed your work around AI platforms at VoltMesh. I am currently building GenAI and agentic workflows at Sembcorp, with prior full-stack engineering experience across UBS, DBS, consulting, and freelance builds.\n\nI am exploring AI platform/product roles in climate or sustainability tech and wanted to ask for 15 minutes of advice before I apply cold. I can share a short proof-of-work note on what I have built around agents, automation, and enterprise GenAI if useful.\n\nWould you be open to a quick chat next week?",
  followUp:
    "If there is no reply after 5 business days, send a concise proof-of-work update and ask whether someone else on the AI platform team would be better to speak with."
};

export const seedDemo: SeedDemo = {
  profileText: demoProfileText,
  target: demoTarget,
  parsedProfile: demoParsedProfile,
  discoveredPeople: demoDiscoveredPeople,
  rankedPaths: demoRankedPaths,
  outreachDraft: demoOutreachDraft
};
