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
    <div className="container mx-auto px-4 py-10">
      <h1 className="mb-10 text-center text-5xl font-extrabold text-primary drop-shadow-lg">
        Browse by Genre
      </h1>

      {/* Genre selector */}
      <div className="mb-12 rounded-xl bg-card p-8 shadow-xl">
        {genresLoading && <Loader />}
        {genresError && (
          <ErrorComponent message={(genresFetchError as Error).message} />
        )}
        {genresResponse && (
          <>
            <label
              htmlFor="genre-select"
              className="mb-4 block text-2xl font-semibold text-accent"
            >
              Select Genre
            </label>
            <select
              id="genre-select"
              value={selectedGenre}
              onChange={handleGenreChange}
              className="w-full cursor-pointer appearance-none rounded-lg border border-primary bg-background px-5 py-3 text-lg text-text shadow-sm transition-all duration-300 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
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
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {animesResponse.map((anime) => (
                  <AnimeCard key={anime.id} anime={anime} />
                ))}
              </div>
              <div className="mt-12 flex items-center justify-center space-x-4">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1 || animesLoading}
                  className="rounded-lg bg-accent px-6 py-3 text-lg font-semibold text-white shadow-md transition-all duration-300 hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xl font-medium text-text-light">
                  Page {page}
                </span>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!hasMoreAnimes || animesLoading}
                  className="rounded-lg bg-accent px-6 py-3 text-lg font-semibold text-white shadow-md transition-all duration-300 hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <p className="text-center text-2xl text-text-light">
              No animes found for this genre or page.
            </p>
          )}
        </>
      )}

      {!selectedGenre && !genresLoading && !genresError && (
        <p className="text-center text-2xl text-text-light">
          Please select a genre to browse animes.
        </p>
      )}
    </div>
  );
};

export default Genres;
