# Zo Relationship Mapper

Localhost proof of concept for an Exa + OpenAI relationship trust-path mapper.

## What It Does

Before applying cold, a mid-career professional can paste a profile, enter a target role/company/person, discover relevant public people, rank the best trust paths, generate contextual outreach, and track the outcome.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Local URLs:

- Web app: `http://localhost:5274`
- API: `http://localhost:8890`

## Environment

Required for live AI/API mode:

```bash
OPENAI_API_KEY=
EXA_API_KEY=
```

Optional for deterministic demo rehearsal:

```bash
FORCE_DEMO_MODE=true
```

The app still works without API keys through seed fallback data.
