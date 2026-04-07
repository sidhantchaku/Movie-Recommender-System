# Movie AI Chatbot

A Vercel-ready GenAI project that searches for a movie and generates a structured AI guide with:

- Movie overview
- Key facts
- Themes
- Similar movie recommendations
- Watch recommendation
- Content note

## Tech Stack

- Next.js App Router
- Vercel AI SDK
- Vercel AI Gateway
- OMDb API for movie metadata
- Zod structured output

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from the example:

```bash
cp .env.example .env.local
```

3. Add your keys:

```bash
AI_GATEWAY_API_KEY=your_vercel_ai_gateway_key
OMDB_API_KEY=your_omdb_api_key
AI_MODEL=openai/gpt-5.4
```

4. Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Deploy On Vercel

1. Push this folder to GitHub.
2. Import the repo in Vercel.
3. Add these environment variables in Vercel Project Settings:

- `AI_GATEWAY_API_KEY`
- `OMDB_API_KEY`
- `AI_MODEL` with `openai/gpt-5.4`

4. Deploy.

Vercel auto-detects Next.js, so no custom build settings are required.

## API Notes

- `OMDB_API_KEY` gives the app factual movie metadata.
- `AI_GATEWAY_API_KEY` lets the Vercel AI SDK call the selected model through Vercel AI Gateway.
- If OMDb does not find an exact movie title, try adding the release year in the search box.
