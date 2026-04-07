import { google } from "@ai-sdk/google";
import { generateText } from "ai";
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

type MovieReport = z.infer<typeof MovieReportSchema>;

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

type OmdbSearchResult = {
  Title?: string;
  Year?: string;
  imdbID?: string;
  Type?: string;
  Poster?: string;
};

type OmdbSearchResponse = {
  Search?: OmdbSearchResult[];
  Response?: string;
  Error?: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsedBody = RequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return Response.json({ error: "Please send a valid movie title." }, { status: 400 });
  }

  if (!hasAiConfig()) {
    return Response.json(
      {
        error:
          "AI is not configured yet. Add GOOGLE_GENERATIVE_AI_API_KEY or AI_GATEWAY_API_KEY in your environment variables."
      },
      { status: 500 }
    );
  }

  const movieTitle = parsedBody.data.movie;
  const movieData = await fetchOmdbMovie(movieTitle);

  try {
    const { text } = await generateText({
      model: getAiModel(),
      system:
        "You are a movie research assistant. Return only valid JSON. Do not wrap the JSON in markdown fences. If metadata is incomplete, be honest in confidenceNote instead of inventing exact facts.",
      prompt: buildPrompt(movieTitle, movieData)
    });
    const report = parseMovieReport(text, movieTitle, movieData);

    return Response.json({
      report: {
        ...report,
        title: movieData?.Title ?? report.title,
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
    console.error("[api/movie] generation failed", error);

    return Response.json({
      report: {
        ...createFallbackReport(movieTitle, movieData),
        title: movieData?.Title ?? movieTitle,
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
  }
}

function hasAiConfig() {
  return Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.AI_GATEWAY_API_KEY ||
      process.env.VERCEL_OIDC_TOKEN
  );
}

function getAiModel() {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const geminiModel =
      process.env.GEMINI_MODEL ??
      (process.env.AI_MODEL?.startsWith("gemini-") ? process.env.AI_MODEL : "gemini-2.5-flash");

    return google(geminiModel);
  }

  return process.env.AI_MODEL ?? "openai/gpt-5.4";
}

async function fetchOmdbMovie(movieTitle: string): Promise<OmdbMovie | null> {
  const apiKey = process.env.OMDB_API_KEY;

  if (!apiKey) {
    return null;
  }

  const exactParams = new URLSearchParams({
    apikey: apiKey,
    plot: "full",
    t: movieTitle
  });

  const exactMovie = await fetchOmdb<OmdbMovie>(exactParams);

  if (exactMovie?.Response !== "False") {
    return exactMovie;
  }

  const searchParams = new URLSearchParams({
    apikey: apiKey,
    s: movieTitle,
    type: "movie"
  });
  const searchResults = await fetchOmdb<OmdbSearchResponse>(searchParams);
  const firstMatch = searchResults?.Search?.find((result) => result.imdbID);

  if (!firstMatch?.imdbID) {
    console.warn("[api/movie] OMDb lookup found no match", {
      movieTitle,
      error: exactMovie?.Error ?? searchResults?.Error
    });
    return null;
  }

  const idParams = new URLSearchParams({
    apikey: apiKey,
    plot: "full",
    i: firstMatch.imdbID
  });

  const movieById = await fetchOmdb<OmdbMovie>(idParams);
  return movieById?.Response === "False" ? null : movieById;
}

async function fetchOmdb<T>(params: URLSearchParams): Promise<T | null> {
  try {
    const response = await fetch(`https://www.omdbapi.com/?${params.toString()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      console.warn("[api/movie] OMDb HTTP request failed", { status: response.status });
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.warn("[api/movie] OMDb request failed", error);
    return null;
  }
}

function buildPrompt(movieTitle: string, movieData: OmdbMovie | null) {
  return `
Movie searched by the user: ${movieTitle}

OMDb metadata:
${movieData ? JSON.stringify(movieData, null, 2) : "No OMDb metadata was found for this query. Still generate a helpful general movie guide, and make the confidenceNote honest."}

Return a structured report for a movie chatbot. Keep it helpful for a student GenAI project demo:
Rules:
- Write only in clear English.
- Do not include markdown headings, code, citations, URLs, or raw scraped text.
- Do not mention tools, prompts, APIs, or JSON.
- Keep every field short and readable.
Return exactly this JSON shape:
{
  "title": "movie title",
  "tagline": "one short sentence",
  "overview": "spoiler-light, 2 to 4 sentences",
  "keyFacts": ["3 to 7 concrete facts"],
  "whyWatch": "who might enjoy it and why",
  "themes": ["3 to 6 short theme phrases"],
  "similarMovies": ["3 to 6 similar movie recommendations"],
  "contentNote": "general age/content note based on rating and genre",
  "confidenceNote": "mention whether OMDb metadata was available"
}
`;
}

function parseMovieReport(text: string, movieTitle: string, movieData: OmdbMovie | null): MovieReport {
  const jsonText = extractJsonObject(text);

  if (!jsonText) {
    return createFallbackReport(movieTitle, movieData);
  }

  try {
    const parsed = MovieReportSchema.safeParse(JSON.parse(jsonText));
    const report = parsed.success ? sanitizeMovieReport(parsed.data) : null;
    return report && isReadableReport(report) ? report : createFallbackReport(movieTitle, movieData);
  } catch (error) {
    console.warn("[api/movie] AI JSON parse failed", error);
    return createFallbackReport(movieTitle, movieData);
  }
}

function extractJsonObject(text: string) {
  const fencedJson = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  if (fencedJson?.[1]) {
    return fencedJson[1];
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return text.slice(start, end + 1);
}

function createFallbackReport(movieTitle: string, movieData: OmdbMovie | null): MovieReport {
  const title = movieData?.Title ?? movieTitle;
  const genre = movieData?.Genre ?? "film";
  const plot = movieData?.Plot && movieData.Plot !== "N/A" ? movieData.Plot : null;

  return {
    title,
    tagline: `A quick AI guide for ${title}.`,
    overview:
      plot ??
      `${title} appears to be the movie you searched for. I could not confirm detailed metadata for this title, so use this as a starting guide rather than a fully verified summary.`,
    keyFacts: [
      movieData?.Year ? `Release year: ${movieData.Year}` : "Release year was not available from metadata.",
      movieData?.Genre ? `Genre: ${movieData.Genre}` : `Genre details were not available; searched as ${genre}.`,
      movieData?.Director ? `Director: ${movieData.Director}` : "Director details were not available.",
      movieData?.Actors ? `Main cast: ${movieData.Actors}` : "Cast details were not available."
    ],
    whyWatch: `Watch ${title} if you are interested in ${genre.toLowerCase()} stories and want a quick recommendation starting point.`,
    themes: ["Story", "Characters", "Tone"],
    similarMovies: ["Search with a more specific title", "Try adding the release year", "Try another movie in the same genre"],
    contentNote: movieData?.Rated ? `Rated ${movieData.Rated}.` : "Rating information was not available.",
    confidenceNote: movieData
      ? "This fallback response is based on available OMDb metadata because the AI response could not be parsed cleanly."
      : "OMDb metadata was not available, so this is a low-confidence fallback response."
  };
}

function sanitizeMovieReport(report: MovieReport): MovieReport {
  return {
    title: cleanText(report.title, 80),
    tagline: cleanText(report.tagline, 140),
    overview: cleanText(report.overview, 700),
    keyFacts: report.keyFacts.map((fact) => cleanText(fact, 180)).filter(Boolean).slice(0, 7),
    whyWatch: cleanText(report.whyWatch, 400),
    themes: report.themes.map((theme) => cleanText(theme, 80)).filter(Boolean).slice(0, 6),
    similarMovies: report.similarMovies.map((movie) => cleanText(movie, 80)).filter(Boolean).slice(0, 6),
    contentNote: cleanText(report.contentNote, 240),
    confidenceNote: cleanText(report.confidenceNote, 240)
  };
}

function cleanText(value: string, maxLength: number) {
  return value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#*_`[\]<>]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .slice(0, maxLength)
    .trim();
}

function isReadableReport(report: MovieReport) {
  const text = [
    report.title,
    report.tagline,
    report.overview,
    report.whyWatch,
    report.contentNote,
    report.confidenceNote,
    ...report.keyFacts,
    ...report.themes,
    ...report.similarMovies
  ].join(" ");

  const suspiciousPatterns = [
    /[{};]/,
    /\bfunction\b|\bconst\b|\blet\b|\breturn\b/i,
    /\bapi\b|\bjson\b|\bprompt\b|\bhttp\b/i,
    /\bRegi[oó]n\b|\badmin\b|\busuario\b|\barchivo\b|\bsistema\b/i
  ];
  const letterMatches = text.match(/[a-z]/gi) ?? [];
  const whitespaceMatches = text.match(/\s/g) ?? [];
  const letterRatio = letterMatches.length / Math.max(text.length, 1);
  const whitespaceRatio = whitespaceMatches.length / Math.max(text.length, 1);

  return (
    report.keyFacts.length >= 3 &&
    report.themes.length >= 3 &&
    report.similarMovies.length >= 3 &&
    letterRatio > 0.45 &&
    whitespaceRatio > 0.08 &&
    !suspiciousPatterns.some((pattern) => pattern.test(text))
  );
}

function safePosterUrl(posterUrl?: string) {
  if (!posterUrl || posterUrl === "N/A") {
    return undefined;
  }

  return posterUrl;
}
