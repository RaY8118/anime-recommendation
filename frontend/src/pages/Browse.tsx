import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AnimeCard } from "../components/AnimeCard";
import { Error } from "../components/Error";
import { Loader } from "../components/Loader";
import { getAllAnimes } from "../services/api";
import type { AnimeOut } from "../types/anime";

const itemsPerPage = 12;

const Browse = () => {
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["allAnime"],
    queryFn: getAllAnimes,
    staleTime: 1000 * 60 * 5,
  });

  const animes: AnimeOut[] = data?.data.results || [];

  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentAnimes = animes.slice(indexOfFirst, indexOfLast);

  const totalPages = Math.ceil(animes.length / itemsPerPage);

  if (isLoading) return <Loader />;
  if (isError) return <Error message={(error as Error).message} />;

  return (
    <div className="container mx-auto px-4 py-8 mt-4 bg-gray-900 text-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-6 text-center">Browse All Animes</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {currentAnimes.map((anime) => (
          <AnimeCard key={anime.id} anime={anime} />
        ))}
      </div>

      <div className="flex justify-center mt-8 space-x-4">
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((prev) => prev - 1)}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="self-center text-lg font-medium text-gray-700">
          Page {currentPage} of {totalPages}
        </span>
        <button
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((prev) => prev + 1)}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Browse;
