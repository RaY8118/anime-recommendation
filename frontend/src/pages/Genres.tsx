import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AnimeCard } from "../components/AnimeCard";
import { Error as ErrorComponent } from "../components/Error";
import { Loader } from "../components/Loader";
import { filterByGenre, getGenres } from "../services/api";
import type { AnimeOut } from "../types/anime";

const limit = 12;

const Genres = () => {
  const [selectedGenre, setSelectedGenre] = useState("");
  const [page, setPage] = useState(1);

  const {
    data: genresResponse,
    isLoading: genresLoading,
    isError: genresError,
    error: genresFetchError,
  } = useQuery({
    queryKey: ["genres"],
    queryFn: async () => {
      const res = await getGenres();
      return res.data.genres;
    },
    staleTime: 1000 * 60 * 10,
  });

  const {
    data: animesResponse,
    isLoading: animesLoading,
    isError: animesError,
    error: animesFetchError,
  } = useQuery({
    queryKey: ["animesByGenre", selectedGenre, page],
    queryFn: async () => {
      const res = await filterByGenre(selectedGenre, page, limit);
      return res.data.results as AnimeOut[];
    },
    enabled: !!selectedGenre,
    staleTime: 1000 * 60 * 5,
  });

  const handleGenreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedGenre(e.target.value);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const hasMoreAnimes = (animesResponse?.length || 0) === limit;

  return (
    <div className="container mx-auto px-4 py-8 mt-4 bg-gray-900 text-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-6 text-center">Browse by Genre</h1>

      {/* Genre selector */}
      <div className="mb-8 bg-gray-800 p-6 rounded-lg shadow-lg">
        {genresLoading && <Loader />}
        {genresError && (
          <ErrorComponent message={(genresFetchError as Error).message} />
        )}
        {genresResponse && (
          <>
            <label
              htmlFor="genre-select"
              className="block mb-2 text-lg font-semibold text-gray-300"
            >
              Select Genre
            </label>
            <select
              id="genre-select"
              value={selectedGenre}
              onChange={handleGenreChange}
              className="w-full px-4 py-2 rounded-md bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">-- Choose a genre --</option>
              {genresResponse.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {animesLoading && <Loader />}
      {animesError && (
        <ErrorComponent message={(animesFetchError as Error).message} />
      )}

      {!animesLoading && !animesError && selectedGenre && animesResponse && (
        <>
          {animesResponse.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {animesResponse.map((anime) => (
                  <AnimeCard key={anime.id} anime={anime} />
                ))}
              </div>
              <div className="flex justify-center mt-8 space-x-4">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1 || animesLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="self-center text-lg font-medium text-gray-300">
                  Page {page}
                </span>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!hasMoreAnimes || animesLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <p className="text-center text-gray-500 text-lg">
              No animes found for this genre or page.
            </p>
          )}
        </>
      )}

      {!selectedGenre && !genresLoading && !genresError && (
        <p className="text-center text-gray-500 text-lg">
          Please select a genre to browse animes.
        </p>
      )}
    </div>
  );
};

export default Genres;
