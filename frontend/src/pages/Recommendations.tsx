import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, useEffect } from "react";
import { AnimeCard } from "../components/AnimeCard";
import { CardGridSkeleton } from "../components/AnimeCardSkeleton";
import { Error } from "../components/Error";
import { useSfw } from "../context/SfwContext";
import { getRecommendations } from "../services/api";
import {
  QueryMode,
  type RecommendationsParams,
  type AnimeListResponse,
} from "../types/anime";
import type { AxiosResponse } from "axios";

const RECOMMENDATIONS_STORAGE_KEY = "recommendations_state";

interface RecommendationsState {
  query: string;
  mode: QueryMode;
  topK: number;
  submittedParams: RecommendationsParams | null;
  data: AxiosResponse<AnimeListResponse> | undefined;
}

const Recommendations = () => {
  const { isSfw } = useSfw();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<QueryMode>(QueryMode.description);
  const [topK, setTopK] = useState(5);
  const [submittedParams, setSubmittedParams] =
    useState<RecommendationsParams | null>(null);

  // Load state from sessionStorage on initial mount
  useEffect(() => {
    const storedState = sessionStorage.getItem(RECOMMENDATIONS_STORAGE_KEY);
    if (storedState) {
      const { query, mode, topK, submittedParams, data } = JSON.parse(
        storedState
      ) as RecommendationsState;
      setQuery(query);
      setMode(mode);
      setTopK(topK);
      setSubmittedParams(submittedParams);
      // Pre-populate react-query cache if data exists
      if (data) {
        queryClient.setQueryData(
          ["recommendations", submittedParams, isSfw],
          data
        );
      }
    }
    // Restore once on mount; re-running on SFW changes would reset user input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["recommendations", submittedParams, isSfw],
    queryFn: () => getRecommendations({ ...submittedParams!, sfw: isSfw }),
    enabled: !!submittedParams,
  });

  // Save state to sessionStorage whenever relevant state changes
  useEffect(() => {
    if (submittedParams) {
      const stateToStore: RecommendationsState = {
        query,
        mode,
        topK,
        submittedParams,
        data,
      };
      sessionStorage.setItem(
        RECOMMENDATIONS_STORAGE_KEY,
        JSON.stringify(stateToStore)
      );
    }
  }, [query, mode, topK, submittedParams, data]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const newSubmittedParams = {
      query,
      mode,
      top_k: topK,
      sfw: isSfw,
    };
    setSubmittedParams(newSubmittedParams);
  };

  // Import useQueryClient from react-query
  const queryClient = useQueryClient();

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="mb-10 text-center text-5xl font-extrabold gradient-text">
        Anime Recommendations
      </h1>

      <form
        onSubmit={handleSubmit}
        className="mb-12 space-y-6 rounded-2xl glass p-8 shadow-xl"
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
            className="w-full rounded-lg border border-border bg-background/60 px-5 py-3 text-lg text-text placeholder-text-light shadow-sm transition-all duration-300 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/60"
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
            className="w-full rounded-lg border border-border bg-background/60 px-5 py-3 text-lg text-text placeholder-text-light shadow-sm transition-all duration-300 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/60"
            min={1}
            max={20}
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-gradient-to-r from-primary to-accent px-6 py-3 text-xl font-bold text-white shadow-md shadow-primary/30 transition-all duration-300 hover:brightness-110"
        >
          {isLoading ? "Getting Recommendations..." : "Get Recommendations"}
        </button>
      </form>

      {isLoading && <CardGridSkeleton count={12} />}
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
