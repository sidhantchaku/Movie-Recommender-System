import { generateText, Output } from "ai";
import { z } from "zod";

export const runtime = "nodejs";

const RequestSchema = z.object({
  movie: z.string().trim().min(1).max(120)
});

const MovieReportSchema = z.object({
  title: z.string(),
  tagline: z.string(),
  overview: z.string(),
  keyFacts: z.array(z.string()).min(3).max(7),
  whyWatch: z.string(),
  themes: z.array(z.string()).min(3).max(6),
  similarMovies: z.array(z.string()).min(3).max(6),
  contentNote: z.string(),
  confidenceNote: z.string()
});

type OmdbMovie = {
  Title?: string;
  Year?: string;
  Rated?: string;
  Runtime?: string;
  Genre?: string;
  Director?: string;
  Actors?: string;
  Plot?: string;
  imdbRating?: string;
  Poster?: string;
  Response?: string;
  Error?: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsedBody = RequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return Response.json({ error: "Please send a valid movie title." }, { status: 400 });
  }

  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    return Response.json(
      {
        error:
          "AI is not configured yet. Add AI_GATEWAY_API_KEY in .env.local or in your Vercel project environment variables."
      },
      { status: 500 }
    );
  }

  const movieTitle = parsedBody.data.movie;
  let movieData: OmdbMovie | null = null;

  try {
    movieData = await fetchOmdbMovie(movieTitle);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? `Movie metadata lookup failed: ${error.message}`
            : "Movie metadata lookup failed."
      },
      { status: 404 }
    );
  }

  try {
    const { output } = await generateText({
      model: process.env.AI_MODEL ?? "openai/gpt-5.4",
      output: Output.object({ schema: MovieReportSchema }),
      system:
        "You are a movie research assistant. Produce concise, factual, spoiler-light movie guidance. If the provided metadata is incomplete, say so in confidenceNote instead of inventing exact facts.",
      prompt: buildPrompt(movieTitle, movieData)
    });

    return Response.json({
      report: {
        ...output,
        title: movieData?.Title ?? output.title,
        posterUrl: safePosterUrl(movieData?.Poster),
        metadata: {
          year: movieData?.Year,
          rated: movieData?.Rated,
          runtime: movieData?.Runtime,
          genre: movieData?.Genre,
          director: movieData?.Director,
          actors: movieData?.Actors,
          imdbRating: movieData?.imdbRating
        }
      }
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "The AI model could not generate the movie report. Check your AI Gateway setup and try again." },
      { status: 500 }
    );
  }
}

async function fetchOmdbMovie(movieTitle: string): Promise<OmdbMovie | null> {
  const apiKey = process.env.OMDB_API_KEY;

  if (!apiKey) {
    return null;
  }

  const params = new URLSearchParams({
    apikey: apiKey,
    plot: "full",
    t: movieTitle
  });

  const response = await fetch(`https://www.omdbapi.com/?${params.toString()}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("OMDb request failed.");
  }

  const data = (await response.json()) as OmdbMovie;

  if (data.Response === "False") {
    throw new Error(data.Error ?? "Movie not found.");
  }

  return data;
}

function buildPrompt(movieTitle: string, movieData: OmdbMovie | null) {
  return `
Movie searched by the user: ${movieTitle}

OMDb metadata:
${movieData ? JSON.stringify(movieData, null, 2) : "No OMDb metadata is available because OMDB_API_KEY is not configured."}

Return a structured report for a movie chatbot. Keep it helpful for a student GenAI project demo:
- tagline: one short sentence.
- overview: spoiler-light, 2 to 4 sentences.
- keyFacts: concrete facts from metadata when available.
- whyWatch: explain who might enjoy it.
- themes: short phrases.
- similarMovies: recommendations based on tone or genre.
- contentNote: general age/content note based on rating and genre.
- confidenceNote: mention whether OMDb metadata was available.
`;
}

function safePosterUrl(posterUrl?: string) {
  if (!posterUrl || posterUrl === "N/A") {
    return undefined;
  }

  return posterUrl;
}
