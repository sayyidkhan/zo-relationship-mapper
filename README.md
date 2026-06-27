# Zo Relationship Mapper

Live deployment: https://zo-relationship-mapper-sayyidkhan.zocomputer.io

Zo Relationship Mapper is a live career opportunity and relationship-mapping tool built for the Supabase Build 2026 hackathon. It helps a candidate move from "I found a job" to "I know who to talk to and why" by combining a real resume/profile, live job discovery, public web research, contact grouping, trust-path ranking, and outreach drafting.

The app intentionally does not fall back to seed/demo data. If OpenAI or Exa is unavailable, the UI shows an explicit error so the operator knows the result is not real.

## Hackathon Submission Links

| Field | Link |
| --- | --- |
| Code repository | https://github.com/sayyidkhan/zo-relationship-mapper |
| Live website | https://zo-relationship-mapper-sayyidkhan.zocomputer.io |
| Demo video | https://youtu.be/Qaa5arkLI6g |
| Pitch deck | https://docs.google.com/presentation/d/1HGynjgllHhS4Ka5_ZNsVEv4eWn-HLSHd/edit?usp=sharing&ouid=102958531012433256044&rtpof=true&sd=true |
| Instagram post | https://www.instagram.com/p/DaFSqK7k2ce/?img_index=1 |

## Product Idea

Cold applications are low-leverage. Most strong opportunities are unlocked through context, timing, and people. This project turns a resume/profile into a practical job-path sprint:

1. Paste a real resume, LinkedIn summary, or operator profile.
2. Use OpenAI to parse the profile into roles, skills, domains, companies, and proof of work.
3. Use Exa to discover live public job opportunities.
4. Rank those jobs from best to worst fit.
5. Select one opportunity.
6. Only after selection, use Exa to discover relevant people around that opportunity.
7. Group people into hiring managers, mentors, and colleagues in the role.
8. Rank the best trust paths.
9. Draft a contextual outreach message.

The intended user is a mid-career builder, operator, or technical founder-type candidate who wants a higher-leverage way to pursue opportunities than mass applying.

## Live Demo

Production URL:

```text
https://zo-relationship-mapper-sayyidkhan.zocomputer.io
```

Health check:

```bash
curl https://zo-relationship-mapper-sayyidkhan.zocomputer.io/api/health
```

Expected live response:

```json
{
  "ok": true,
  "service": "zo-relationship-mapper",
  "mode": "live",
  "openaiConfigured": true,
  "exaConfigured": true
}
```

## Core Flow

### 1. Resume / Profile

The user pastes their resume, LinkedIn summary, or profile. The backend sends the text to OpenAI and returns a structured profile:

- career summary
- previous companies
- roles
- skills
- domains
- proof of work

### 2. Ranked Jobs

The app uses the parsed profile and the search focus to query Exa for public opportunities. OpenAI then normalizes and ranks the Exa results. Jobs are shown best to worst with:

- fit score
- company
- location
- seniority
- source URL
- why the role fits
- match signals
- concerns to validate

### 3. Opportunity Selection

People are not shown globally. The user must click a ranked opportunity first. This keeps the experience focused and avoids dumping irrelevant contacts into the UI.

### 4. People To Talk To

After an opportunity is selected, Exa discovers public people and pages related to the selected company and role. OpenAI groups the results into:

- hiring managers
- mentors
- colleagues working in or near the role

### 5. Trust Path Ranking

The app ranks discovered contacts by likely usefulness, confidence, relevance, risks, and suggested ask. This helps the user decide who to approach first.

### 6. Outreach Drafting

The app generates a warm, contextual outreach draft grounded in the parsed profile, selected job, and selected contact path.

## Features

- Live profile parsing with OpenAI.
- Live job discovery with Exa.
- Job ranking from best to worst fit.
- Click-to-inspect opportunity model.
- People discovery only after a job is selected.
- Contact grouping by hiring manager, mentor, and colleague.
- Trust-path ranking.
- Outreach draft generation.
- Single-origin production deployment on Zo Computer.
- No local seed data fallback.
- Explicit API and configuration error states.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite |
| Styling | Custom CSS |
| State/data | React state, TanStack Query dependency available |
| Backend | Node.js, Express, TypeScript via tsx |
| AI reasoning | OpenAI Chat Completions |
| Web discovery | Exa Search API |
| Deployment | Zo Computer Hosting |

## Architecture

The production app runs as one Node service:

```text
Browser
  -> React/Vite static assets served from dist
  -> Express API on the same origin
  -> OpenAI for reasoning, ranking, and drafting
  -> Exa for live public web discovery
```

In local development, Vite and Express can run as separate processes:

```text
localhost:5274  React/Vite web app
localhost:8890  Express API
```

In production, Express serves both:

```text
https://zo-relationship-mapper-sayyidkhan.zocomputer.io
https://zo-relationship-mapper-sayyidkhan.zocomputer.io/api/*
```

## API Routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Confirms service and API key configuration state |
| POST | `/api/profile/parse` | Parses resume/profile text into structured career data |
| POST | `/api/jobs/discover` | Searches and ranks live job opportunities |
| POST | `/api/people/discover` | Discovers people for a selected opportunity |
| POST | `/api/trust-paths/rank` | Ranks discovered people as trust paths |
| POST | `/api/outreach/draft` | Drafts contextual outreach |

## Project Structure

```text
.
|-- docs/
|   |-- assets/
|   `-- zo-relationship-mapper-presentation.pptx
|-- scripts/
|   |-- zo-deploy.sh
|   `-- zo-restart.sh
|-- server/
|   `-- index.ts
|-- src/
|   |-- App.tsx
|   |-- lib/api.ts
|   |-- main.tsx
|   |-- styles.css
|   `-- types/api.ts
|-- .env.example
|-- package.json
|-- package-lock.json
|-- tsconfig.json
`-- vite.config.ts
```

## Environment Variables

Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
```

Required:

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | Profile parsing, ranking, reasoning, and outreach drafting |
| `EXA_API_KEY` | Yes | Live public job and people discovery |

Optional:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model used by the backend |
| `API_PORT` | `8890` | Local API port when `PORT` is not provided |
| `PORT` | unset | Production platform port override |
| `VITE_API_BASE_URL` | empty in production | Frontend API base URL. Use `http://localhost:8890` for split local dev |

Never commit `.env`.

## Local Development

Install dependencies:

```bash
npm install
```

Create your local env file:

```bash
cp .env.example .env
```

Start both API and web app:

```bash
npm run dev
```

Local URLs:

```text
Web app: http://localhost:5274
API:     http://localhost:8890
```

## Useful Commands

Typecheck:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

Start production server locally:

```bash
npm run start
```

Preview Vite build only:

```bash
npm run preview
```

## Deployment

The app is deployed on Zo Computer as a single Node service.

Current production URL:

```text
https://zo-relationship-mapper-sayyidkhan.zocomputer.io
```

Zo Computer project directory:

```text
/home/workspace/hackathon/suphackathon2026/zo-relationship-mapper
```

Recommended Zo workspace layout:

```text
/home/workspace/hackathon/suphackathon2026/
|-- zo-relationship-mapper/
`-- zo-expert/
```

Zo Hosting service command:

```bash
cd /home/workspace/hackathon/suphackathon2026/zo-relationship-mapper
PORT=8000 bash scripts/zo-deploy.sh
```

The deploy script:

1. enters the app directory
2. fetches and fast-forwards the configured branch
3. checks that `.env` exists
4. runs `npm ci`
5. builds the Vite frontend
6. starts the Express server

## Sync Deploy From Zo Terminal

For a streamlined terminal deploy on Zo Computer:

```bash
cd /home/workspace/hackathon/suphackathon2026/zo-relationship-mapper
PORT=8000 bash scripts/zo-restart.sh
```

This helper stops the previous process recorded in `logs/zo-deploy.pid`, pulls/builds through `scripts/zo-deploy.sh`, starts the app in the background, and writes logs to:

```text
logs/zo-deploy.log
```

To view logs:

```bash
tail -f logs/zo-deploy.log
```

To sync and rebuild without starting the server:

```bash
ZO_SYNC_ONLY=1 bash scripts/zo-deploy.sh
```

## Data Integrity

This project is built to operate in live mode only:

- no fake jobs are injected
- no fake people are injected
- no silent fallback to seed data
- failures are shown as visible UI/API errors
- job and people summaries are grounded in Exa results plus the parsed profile

This makes the demo more fragile than a seeded prototype, but more honest for evaluating the actual product flow.

## Troubleshooting

### Missing API Keys

If the health check shows `openaiConfigured: false` or `exaConfigured: false`, add the missing key to `.env` on the running machine and restart the service.

### Zo Public URL Returns 503

Start or restart the app from the Zo terminal:

```bash
cd /home/workspace/hackathon/suphackathon2026/zo-relationship-mapper
PORT=8000 bash scripts/zo-restart.sh
```

Then check:

```bash
curl http://127.0.0.1:8000/api/health
curl https://zo-relationship-mapper-sayyidkhan.zocomputer.io/api/health
```

### Local Frontend Cannot Reach API

Set this in `.env` for split local development:

```text
VITE_API_BASE_URL=http://localhost:8890
```

For production, leave `VITE_API_BASE_URL` empty so the frontend calls the same deployed origin.

## Hackathon Notes

The project is framed as a relationship-first job search sprint. The key wedge is not "another job board"; it is the bridge from opportunity discovery to the people who can help the candidate understand, validate, and pursue the role.

The current version proves the end-to-end loop:

- user profile in
- ranked opportunities out
- selected opportunity
- relevant people surfaced
- trust paths ranked
- outreach generated

Future work would turn this into an operator-grade workflow with saved profiles, job tracking, CRM-style contact states, follow-up reminders, and learning loops from outreach outcomes.
