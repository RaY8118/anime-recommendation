import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { AnimeCard } from "../components/AnimeCard";
import { Error } from "../components/Error";
import { Loader } from "../components/Loader";
import { getRecommendations } from "../services/api";
import { QueryMode, type RecommendationsParams } from "../types/anime";

const Recommendations = () => {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<QueryMode>(QueryMode.description);
  const [topK, setTopK] = useState(5);
  const [submittedParams, setSubmittedParams] =
    useState<RecommendationsParams | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["recommendations", submittedParams],
    queryFn: () => getRecommendations(submittedParams!),
    enabled: !!submittedParams,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmittedParams({
      query,
      mode,
      top_k: topK,
    });
  };

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="mb-10 text-center text-5xl font-extrabold text-primary drop-shadow-lg">
        Anime Recommendations
      </h1>

      <form
        onSubmit={handleSubmit}
        className="mb-12 space-y-6 rounded-xl bg-card p-8 shadow-xl"
      >
        <div>
          <label
            htmlFor="query"
            className="mb-3 block text-2xl font-semibold text-accent"
          >
            Query
          </label>
          <input
            id="query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-primary bg-background px-5 py-3 text-lg text-text placeholder-text-dark shadow-sm transition-all duration-300 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Enter your query (e.g., Naruto, comedy)"
            required
          />
        </div>

        <div>
          <label
            htmlFor="mode"
            className="mb-3 block text-2xl font-semibold text-accent"
          >
            Mode
          </label>
          <select
            id="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as QueryMode)}
            className="w-full cursor-pointer appearance-none rounded-lg border border-primary bg-background px-5 py-3 text-lg text-text shadow-sm transition-all duration-300 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value={QueryMode.anime_name}>Anime Name</option>
            <option value={QueryMode.genre}>Genre</option>
            <option value={QueryMode.description}>Description</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="topK"
            className="mb-3 block text-2xl font-semibold text-accent"
          >
            Number of Recommendations (Top K)
          </label>
          <input
            id="topK"
            type="number"
            value={topK}
            onChange={(e) => setTopK(parseInt(e.target.value))}
            className="w-full rounded-lg border border-primary bg-background px-5 py-3 text-lg text-text placeholder-text-dark shadow-sm transition-all duration-300 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
            min={1}
            max={20}
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-primary px-6 py-3 text-xl font-bold text-white shadow-md transition-all duration-300 hover:bg-accent"
        >
          {isLoading ? "Getting Recommendations..." : "Get Recommendations"}
        </button>
      </form>

      {isLoading && <Loader />}
      {isError && <Error message={(error as Error).message} />}

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {data?.data.results.map((anime) => (
          <AnimeCard key={anime.id} anime={anime} />
        ))}
      </div>

      {!isLoading && !error && data?.data.results.length === 0 && query && (
        <p className="text-center text-2xl text-text-light">
          No recommendations found for your query.
        </p>
      )}
    </div>
  );
};

export default Recommendations;
