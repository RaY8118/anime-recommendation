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
    <div className="container mx-auto px-4 py-8 mt-4 bg-gray-900 text-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Anime Recommendations
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-4 mb-8"
      >
        <div>
          <label
            htmlFor="query"
            className="block mb-2 text-lg font-semibold text-gray-300"
          >
            Query
          </label>
          <input
            id="query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-4 py-2 rounded-md bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            placeholder="Enter your query (e.g., Naruto, comedy)"
            required
          />
        </div>

        <div>
          <label
            htmlFor="mode"
            className="block mb-2 text-lg font-semibold text-gray-300"
          >
            Mode
          </label>
          <select
            id="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as QueryMode)}
            className="w-full px-4 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-blue-500"
          >
            <option value={QueryMode.anime_name}>Anime Name</option>
            <option value={QueryMode.genre}>Genre</option>
            <option value={QueryMode.description}>Description</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="topK"
            className="block mb-2 text-lg font-semibold text-gray-300"
          >
            Number of Recommendations (Top K)
          </label>
          <input
            id="topK"
            type="number"
            value={topK}
            onChange={(e) => setTopK(parseInt(e.target.value))}
            className="w-full px-4 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-blue-500"
            min={1}
            max={20}
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 ease-in-out"
        >
          {isLoading ? "Getting Recommendations..." : "Get Recommendations"}
        </button>
      </form>

      {isLoading && <Loader />}
      {isError && <Error message={(error as Error).message} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {data?.data.results.map((anime) => (
          <AnimeCard key={anime.id} anime={anime} />
        ))}
      </div>

      {!isLoading && !error && data?.data.results.length === 0 && query && (
        <p className="text-center text-gray-500 text-lg">
          No recommendations found for your query.
        </p>
      )}
    </div>
  );
};

export default Recommendations;
