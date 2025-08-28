import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AnimeCard } from "../components/AnimeCard";
import { AnimeFilters } from "../components/AnimeFilter";
import { Error } from "../components/Error";
import { Loader } from "../components/Loader";
import { getAllAnimes } from "../services/api";

import { useDebounce } from "../hooks/newDebounce";
import type { AnimeOut, Filters } from "../types/anime";

const itemsPerPage = 12;
const chunkSize = itemsPerPage * 3;

const Browse = () => {
  const [filters, setFilters] = useState<Filters>({
    searchQuery: "",
  });

  const [currentChunkPage, setCurrentChunkPage] = useState(1);
  const [currentDisplayPage, setCurrentDisplayPage] = useState(1);

  const debouncedFilters = useDebounce(filters, 1000);

  useEffect(() => {
    setCurrentChunkPage(1);
    setCurrentDisplayPage(1);
  }, [debouncedFilters]);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["allAnime", currentChunkPage, debouncedFilters],
    queryFn: () =>
      getAllAnimes(currentChunkPage, chunkSize, {
        genre: debouncedFilters.selectedGenre,
        min_score: debouncedFilters.minScore,
        max_score: debouncedFilters.maxScore,
        season: debouncedFilters.season,
        year: debouncedFilters.year,
        query: debouncedFilters.searchQuery,
      }),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading && !data) return <Loader />;
  if (isError) return <Error message={(error as Error).message} />;

  const animes: AnimeOut[] = data?.results || [];
  const totalPages = Math.ceil((data?.total || 0) / itemsPerPage);

  const startIndex = (currentDisplayPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentAnimes = animes.slice(startIndex, endIndex);

  const handleNext = () => {
    const nextDisplayPage = currentDisplayPage + 1;
    const nextItemIndex = (nextDisplayPage - 1) * itemsPerPage;

    if (nextItemIndex >= animes.length) {
      setCurrentChunkPage((prev) => prev + 1);
      setCurrentDisplayPage(1);
    } else {
      setCurrentDisplayPage(nextDisplayPage);
    }
  };

  const handlePrevious = () => {
    if (currentDisplayPage === 1 && currentChunkPage > 1) {
      setCurrentChunkPage((prev) => prev - 1);
      setCurrentDisplayPage(Math.ceil(chunkSize / itemsPerPage));
    } else {
      setCurrentDisplayPage((prev) => Math.max(prev - 1, 1));
    }
  };

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="mb-10 text-center text-5xl font-extrabold text-primary drop-shadow-lg">
        Browse All Animes
      </h1>

      {isFetching && (
        <p className="text-center text-gray-400">Loading more animes...</p>
      )}

      <AnimeFilters filters={filters} setFilters={setFilters} />

      {/* 🔧 Anime Cards */}
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {animes.length === 0 ? (
          <div className="col-span-full text-center mt-20 text-2xl font-semibold text-gray-500">
            No anime found with the selected filters.{" "}
            {debouncedFilters.searchQuery && (
              <p className="mt-4 text-xl">
                Did you mean to suggest "{debouncedFilters.searchQuery}"?{" "}
                <a
                  href={`/suggest?animeName=${debouncedFilters.searchQuery}&fromNotFound=true`}
                  className="text-primary hover:underline"
                >
                  Suggest it here!
                </a>
              </p>
            )}
          </div>
        ) : (
          currentAnimes.map((anime) => (
            <AnimeCard key={anime.id} anime={anime} />
          ))
        )}
      </div>
      {/* 🔧 Pagination */}
      <div className="mt-12 flex items-center justify-center space-x-4">
        <button
          disabled={currentChunkPage === 1 && currentDisplayPage === 1}
          onClick={handlePrevious}
          className="rounded-lg bg-accent px-6 py-3 text-lg font-semibold text-white shadow-md transition-all duration-300 hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-xl font-medium text-text-light">
          Page{" "}
          {(currentChunkPage - 1) * Math.ceil(chunkSize / itemsPerPage) +
            currentDisplayPage}{" "}
          of {totalPages}
        </span>
        <button
          disabled={
            (currentChunkPage - 1) * chunkSize + endIndex >= (data?.total || 0)
          }
          onClick={handleNext}
          className="rounded-lg bg-accent px-6 py-3 text-lg font-semibold text-white shadow-md transition-all duration-300 hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Browse;
