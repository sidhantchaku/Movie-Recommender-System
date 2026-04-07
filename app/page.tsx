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

const sampleMovies = ["Inception", "Interstellar", "3 Idiots", "Welcome"];

export default function Home() {
  const [movie, setMovie] = useState("");
  const [report, setReport] = useState<MovieReport | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function generateMovieReport(query: string) {
    const movieQuery = query.trim();

    if (!movieQuery) {
      setError("Type a movie name first.");
      return;
    }

    setMovie(movieQuery);
    setIsLoading(true);
    setError("");
    setReport(null);

    try {
      const response = await fetch("/api/movie", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ movie: movieQuery })
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void generateMovieReport(movie);
  }

  return (
    <main className="page-shell">
      <nav className="top-nav" aria-label="Main navigation">
        <div className="brand">
          <span className="brand-mark">AI</span>
          <span>MovieLens</span>
        </div>
        <div className="nav-pill">Gemini + OMDb</div>
      </nav>

      <section className="hero-layout">
        <div className="hero-copy">
          <p className="eyebrow">GenAI movie discovery</p>
          <h1>Find a movie. Get the story, vibe, and watch guide.</h1>
          <p>
            Search any title and get a clean AI-generated movie card with key facts,
            themes, similar picks, and a spoiler-light overview.
          </p>

          <form className="search-console" onSubmit={handleSubmit}>
            <label htmlFor="movie-search">Movie title</label>
            <div className="search-row">
              <input
                aria-label="Movie title"
                id="movie-search"
                onChange={(event) => setMovie(event.target.value)}
                placeholder="Try Inception, Welcome, 3 Idiots..."
                value={movie}
              />
              <button disabled={isLoading} type="submit">
                {isLoading ? "Generating..." : "Generate"}
              </button>
            </div>
          </form>

          <div className="quick-picks" aria-label="Suggested movie searches">
            {sampleMovies.map((sample) => (
              <button disabled={isLoading} key={sample} onClick={() => generateMovieReport(sample)} type="button">
                {sample}
              </button>
            ))}
          </div>

          {error ? <p className="error-banner">{error}</p> : null}
        </div>

        <aside className="hero-card" aria-label="Project highlights">
          <div className="orb" />
          <p className="hero-card-label">Live stack</p>
          <h2>Movie intelligence, generated on demand.</h2>
          <div className="feature-grid">
            <FeatureCard title="Metadata" value="OMDb" />
            <FeatureCard title="AI model" value="Gemini" />
            <FeatureCard title="Deploy" value="Vercel" />
            <FeatureCard title="Output" value="JSON cards" />
          </div>
        </aside>
      </section>

      {report ? <MovieResult report={report} /> : <EmptyState />}
    </main>
  );
}

function FeatureCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="feature-card">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
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
    <section className="movie-panel" aria-label={`${report.title} AI report`}>
      <div className="poster-wrap">
        {report.posterUrl ? (
          <Image
            alt={`${report.title} poster`}
            className="poster"
            height={480}
            src={report.posterUrl}
            width={320}
          />
        ) : (
          <div className="poster poster-fallback">No poster available</div>
        )}
      </div>

      <div className="report-content">
        <div className="movie-title">
          <p className="eyebrow">AI generated report</p>
          <h2>{report.title}</h2>
          <p>{report.tagline}</p>
          {facts.length ? (
            <div className="pills">
              {facts.map((fact) => (
                <span className="pill" key={fact}>
                  {fact}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <InfoSection title="Overview">{report.overview}</InfoSection>

        <div className="report-grid">
          <ListSection items={report.keyFacts} title="Key Facts" />
          <InfoSection title="Why Watch">{report.whyWatch}</InfoSection>
          <ListSection items={report.themes} title="Themes" />
          <ListSection items={report.similarMovies} title="Similar Movies" />
        </div>

        <div className="report-grid two-column">
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
    <section className="empty-state">
      <div>
        <p className="eyebrow">Ready when you are</p>
        <h2>Search a film to generate your first movie card.</h2>
      </div>
      <div className="empty-steps">
        <span>1. Enter a title</span>
        <span>2. Fetch movie metadata</span>
        <span>3. Generate AI guide</span>
      </div>
    </section>
  );
}
