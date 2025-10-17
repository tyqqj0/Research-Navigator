This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Configuration

This app calls AI providers via a same-origin backend proxy to keep your API key on the server and enable reliable SSE streaming.

- Backend proxy endpoint: `/api/backend/*` (frontend default AI base is `/api/backend/v1`)
- The proxy forwards to upstreams using server-side envs. It supports two upstreams:
  - AI upstream for OpenAI-compatible paths (e.g. `/v1/...`, `/chat/completions`, `/responses`)
  - Research backend for your literature/parse/search API (e.g. `/api/v1/...`)

Add the following to your `.env.local` (server-side only):

```bash
# Upstream OpenAI-compatible API origin (no trailing slash, no /v1)
BACKEND_API_BASE_URL=https://api.openai.com
BACKEND_API_KEY=sk-your-real-key

# Research/file-parsing backend (if different service/port)
# Example: local research service on 9000
RESEARCH_API_BASE_URL=http://localhost:9000
RESEARCH_API_KEY=your-research-service-key
```

Optional (browser-visible) overrides:

```bash
# Active preset name; defaults to zju_default
NEXT_PUBLIC_ACTIVE_PRESET=zju_default

# Override the same-origin AI base path (defaults to /api/backend/v1)
# Use only for debugging; no secrets here
NEXT_PUBLIC_AI_BASE_URL=/api/backend/v1
```

Notes:
- The frontend never includes an API key. Authorization is injected by the server in `Authorization: Bearer $BACKEND_API_KEY`.
- SSE streaming is passed through without buffering for responsive token-by-token updates.

### How routing works

- Requests sent to `/api/backend/v1/...`, `/api/backend/chat/completions`, `/api/backend/responses` route to `BACKEND_API_BASE_URL` with `BACKEND_API_KEY`.
- Requests sent to `/api/backend/api/...` route to `RESEARCH_API_BASE_URL` with `RESEARCH_API_KEY`.
- If `RESEARCH_API_BASE_URL` is not set, research routes fall back to `BACKEND_API_BASE_URL`.

### Examples

1) All-in-one upstream (single port/service):
```bash
BACKEND_API_BASE_URL=http://localhost:8000
BACKEND_API_KEY=dev-ai-key
# RESEARCH_* not set → uses BACKEND_* for both kinds
```

2) Split services (AI on 8000, research on 9000):
```bash
BACKEND_API_BASE_URL=http://localhost:8000
BACKEND_API_KEY=dev-ai-key
RESEARCH_API_BASE_URL=http://localhost:9000
RESEARCH_API_KEY=dev-research-key
```
