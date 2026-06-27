# Zo Relationship Mapper

Localhost proof of concept for an Exa + OpenAI relationship trust-path mapper.

## What It Does

Before applying cold, a mid-career professional can paste a profile, discover live job opportunities ranked best to worst, select an opportunity, find relevant people to talk to around that company, rank the best contact paths, generate contextual outreach, and track the outcome.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Local URLs:

- Web app: `http://localhost:5274`
- API: `http://localhost:8890`

## Deploy

The app deploys as one Node service. Build the frontend, then start Express:

```bash
npm ci
npm run build
npm run start
```

For Zo Computer Hosting, use this service command from the project directory:

```bash
bash scripts/zo-deploy.sh
```

For a terminal-based sync deploy on Zo Computer, run:

```bash
PORT=8000 bash scripts/zo-restart.sh
```

To sync and rebuild without starting the server:

```bash
ZO_SYNC_ONLY=1 bash scripts/zo-deploy.sh
```

## Environment

Required for live AI/API mode:

```bash
OPENAI_API_KEY=
EXA_API_KEY=
```

The app runs live only. If either API key is missing or an API call fails, the UI shows an explicit error instead of substituting local data.
