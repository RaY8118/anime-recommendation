import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AnimeCard } from "../components/AnimeCard";
import { Error } from "../components/Error";
import { Loader } from "../components/Loader";
import { getAllAnimes } from "../services/api";
import type { AnimeOut } from "../types/anime";

const Browse = () => {
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["allAnime", currentPage],
    queryFn: () => getAllAnimes(currentPage),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) return <Loader />;
  if (isError) return <Error message={(error as Error).message} />;

  const animes: AnimeOut[] = data?.results || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="mb-10 text-center text-5xl font-extrabold text-primary drop-shadow-lg">
        Browse All Animes
      </h1>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {animes.map((anime) => (
          <AnimeCard key={anime.id} anime={anime} />
        ))}
      </div>

      <div className="mt-12 flex items-center justify-center space-x-4">
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((prev) => prev - 1)}
          className="rounded-lg bg-accent px-6 py-3 text-lg font-semibold text-white shadow-md transition-all duration-300 hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-xl font-medium text-text-light">
          Page {currentPage} of {totalPages}
        </span>
        <button
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((prev) => prev + 1)}
          className="rounded-lg bg-accent px-6 py-3 text-lg font-semibold text-white shadow-md transition-all duration-300 hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Browse;
