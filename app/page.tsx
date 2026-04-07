"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

type MovieReport = {
  title: string;
  tagline: string;
  overview: string;
  keyFacts: string[];
  whyWatch: string;
  themes: string[];
  similarMovies: string[];
  contentNote: string;
  confidenceNote: string;
  posterUrl?: string;
  metadata?: {
    year?: string;
    rated?: string;
    runtime?: string;
    genre?: string;
    director?: string;
    actors?: string;
    imdbRating?: string;
  };
};

export default function Home() {
  const [movie, setMovie] = useState("");
  const [report, setReport] = useState<MovieReport | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = movie.trim();

    if (!query) {
      setError("Type a movie name first.");
      return;
    }

    setIsLoading(true);
    setError("");
    setReport(null);

    try {
      const response = await fetch("/api/movie", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ movie: query })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Something went wrong.");
      }

      setReport(data.report);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">GenAI movie discovery</p>
        <h1>Search any movie. Get an AI-powered guide.</h1>
        <p>
          Enter a title and the app combines movie metadata with a generative AI summary:
          story overview, key facts, themes, watch reasons, content note, and similar picks.
        </p>
      </section>

      <section className="search-card" aria-label="Movie search">
        <form className="search-form" onSubmit={handleSubmit}>
          <input
            aria-label="Movie title"
            onChange={(event) => setMovie(event.target.value)}
            placeholder="Try Interstellar, Inception, 3 Idiots..."
            value={movie}
          />
          <button disabled={isLoading} type="submit">
            {isLoading ? "Thinking..." : "Generate"}
          </button>
        </form>
        <p className="hint">
          Deploy-ready for Vercel. Uses <strong>GOOGLE_GENERATIVE_AI_API_KEY</strong> for Gemini and{" "}
          <strong>OMDB_API_KEY</strong> when movie metadata is available.
        </p>
        {error ? <p className="error">{error}</p> : null}
      </section>

      {report ? <MovieResult report={report} /> : <EmptyState />}
    </main>
  );
}

function MovieResult({ report }: { report: MovieReport }) {
  const facts = [
    report.metadata?.year,
    report.metadata?.rated,
    report.metadata?.runtime,
    report.metadata?.genre,
    report.metadata?.imdbRating ? `IMDb ${report.metadata.imdbRating}` : undefined
  ].filter(Boolean);

  return (
    <section className="result-card" aria-label={`${report.title} AI report`}>
      <div className="result-grid">
        {report.posterUrl ? (
          <Image
            alt={`${report.title} poster`}
            className="poster"
            height={390}
            src={report.posterUrl}
            width={260}
          />
        ) : (
          <div className="poster poster-fallback">No poster available</div>
        )}

        <div className="movie-content">
          <div className="movie-title">
            <h2>{report.title}</h2>
            <p>{report.tagline}</p>
            {facts.length ? <div className="pills">{facts.map((fact) => <span className="pill" key={fact}>{fact}</span>)}</div> : null}
          </div>

          <InfoSection title="Overview">{report.overview}</InfoSection>
          <ListSection items={report.keyFacts} title="Key Facts" />
          <InfoSection title="Why Watch">{report.whyWatch}</InfoSection>
          <ListSection items={report.themes} title="Themes" />
          <ListSection items={report.similarMovies} title="Similar Movies" />
          <InfoSection title="Content Note">{report.contentNote}</InfoSection>
          <InfoSection title="Confidence">{report.confidenceNote}</InfoSection>
        </div>
      </div>
    </section>
  );
}

function InfoSection({ children, title }: { children: string; title: string }) {
  return (
    <section className="section">
      <h3>{title}</h3>
      <p>{children}</p>
    </section>
  );
}

function ListSection({ items, title }: { items: string[]; title: string }) {
  return (
    <section className="section">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="empty-card">
      <div className="section">
        <h3>How it works</h3>
        <p>
          The API route searches OMDb for movie details, then asks the model to produce
          a structured report. The UI renders fields directly instead of dumping raw AI text.
        </p>
      </div>
    </section>
  );
}
