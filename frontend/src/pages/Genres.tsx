import { useEffect, useState } from "react";
import { getGenres, filterByGenre, type AnimeOut } from "../services/api";
import { AnimeCard } from "../components/AnimeCard";
import { Loader } from "../components/Loader";
import { Error } from "../components/Error";

const Genres = () => {
  const [genres, setGenres] = useState<string[]>([]);
  const [selectedGenre, setSelectedGenre] = useState("");
  const [animes, setAnimes] = useState<AnimeOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 12; // Increased limit for better display

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await getGenres();
        setGenres(response.data.genres);
      } catch (err) {
        console.error("Error fetching genres:", err);
        setError("Failed to load genres.");
      }
    };
    fetchGenres();
  }, []);

  const fetchAnimesByGenre = async (genre: string, page: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await filterByGenre(genre, page, limit);
      setAnimes(response.data.results);
    } catch (err) {
      console.error("Error fetching animes by genre:", err);
      setError("Failed to fetch animes for this genre.");
      setAnimes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const genre = e.target.value;
    setSelectedGenre(genre);
    setPage(1); // Reset to first page on genre change
    if (genre) {
      fetchAnimesByGenre(genre, 1);
    } else {
      setAnimes([]);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchAnimesByGenre(selectedGenre, newPage);
  };

  const hasMoreAnimes = animes.length === limit;

  return (
    <div className="container mx-auto px-4 py-8 mt-4 bg-gray-900 text-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-6 text-center">Browse by Genre</h1>

      <div className="mb-8 bg-gray-800 p-6 rounded-lg shadow-lg">
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
          {genres.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </select>
      </div>

      {loading && <Loader />}
      {error && <Error message={error} />}

      {!loading && !error && selectedGenre && animes.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {animes.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
          <div className="flex justify-center mt-8 space-x-4">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1 || loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="self-center text-lg font-medium text-gray-700">
              Page {page}
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={!hasMoreAnimes || loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </>
      )}

      {!loading && !error && selectedGenre && animes.length === 0 && (
        <p className="text-center text-gray-500 text-lg">
          No animes found for this genre or page.
        </p>
      )}

      {!loading && !error && !selectedGenre && (
        <p className="text-center text-gray-500 text-lg">
          Please select a genre to browse animes.
        </p>
      )}
    </div>
  );
};

export default Genres;
