import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Error as ErrorComponent } from "../components/Error";
import { Loader } from "../components/Loader";
import { getAnimeByName, addToWatchlist } from "../services/api";
import { AnimeStatus } from "../types/anime";
import type { AnimeOut } from "../types/anime";
import { useAuth0 } from "@auth0/auth0-react";
import { useState } from "react";

const AnimeDetails = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [userAnimeStatus, setUserAnimeStatus] = useState<AnimeStatus>(AnimeStatus.PLANNED);

  const {
    data: animeResponse,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["animeDetails", name],
    queryFn: async () => {
      if (!name) throw new Error("Anime name is missing");
      const response = await getAnimeByName(name);
      return response.data.anime;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!name,
  });

  const handleAddToWatchlist = async () => {
    if (!isAuthenticated) {
      alert("Please log in to add to watchlist.");
      return;
    }

    if (!animeResponse?.id) {
      alert("Anime ID not available.");
      return;
    }

    try {
      const token = await getAccessTokenSilently();
      await addToWatchlist(String(animeResponse.id), userAnimeStatus, token);
      alert("Anime added to watchlist!");
    } catch (error) {
      console.error("Failed to add to watchlist:", error);
      alert("Failed to add anime to watchlist.");
    }
  };

  if (isLoading) return <Loader />;
  if (isError) return <ErrorComponent message={(error as Error).message} />;
  if (!animeResponse) return <ErrorComponent message="Anime not found" />;

  const anime: AnimeOut = animeResponse;

  return (
    <div className="container mx-auto px-4 py-10">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 rounded-lg bg-primary px-6 py-2 text-lg font-semibold text-white shadow-md transition duration-300 ease-in-out hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-75"
      >
        &larr; Back
      </button>

      <div className="flex flex-col gap-8 rounded-xl bg-card p-8 shadow-xl lg:flex-row">
        {/* Anime Cover Image */}
        <div className="flex-shrink-0 lg:w-1/3">
          <img
            src={anime.coverImage?.large}
            alt={anime.title.romaji}
            className="w-full rounded-lg object-cover shadow-lg"
          />
        </div>

        {/* Anime Details */}
        <div className="flex-1 text-text">
          <h1 className="mb-2 text-center text-4xl font-extrabold text-primary drop-shadow-md lg:text-left lg:text-5xl">
            {anime.title.display_english || anime.title.display_romaji}
          </h1>
          {anime.title.display_english && (
            <h2 className="mb-6 text-center text-xl text-text-light lg:text-left lg:text-2xl">
              ({anime.title.display_romaji})
            </h2>
          )}

          <p className="mb-6 leading-relaxed text-text-light lg:text-lg">
            {anime.description}
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="detail-item">
              <strong className="text-secondary">Genres:</strong>{" "}
              <span className="text-text-light">{anime.genres.join(", ")}</span>
            </div>
            <div className="detail-item">
              <strong className="text-secondary">Average Score:</strong>{" "}
              <span className="text-text-light">
                {anime.averageScore ? `${anime.averageScore}%` : "N/A"}
              </span>
            </div>
            <div className="detail-item">
              <strong className="text-secondary">Episodes:</strong>{" "}
              <span className="text-text-light">
                {anime.episodes ? `${anime.episodes}` : "N/A"}
              </span>
            </div>
            <div className="detail-item">
              <strong className="text-secondary">Duration:</strong>{" "}
              <span className="text-text-light">
                {anime.duration ? `${anime.duration} minutes` : "N/A"}
              </span>
            </div>
            <div className="detail-item">
              <strong className="text-secondary">Season:</strong>{" "}
              <span className="text-text-light">
                {anime.season ? `${anime.season}` : "N/A"} (
                {anime.seasonYear ? `${anime.seasonYear}` : "N/A"})
              </span>
            </div>
            <div className="detail-item">
              <strong className="text-secondary">Status:</strong>{" "}
              <span className="text-text-light">
                {anime.status ? `${anime.status}` : "N/A"}
              </span>
            </div>
            <div className="detail-item">
              <strong className="text-secondary">Source:</strong>{" "}
              <span className="text-text-light">
                {anime.source ? `${anime.source}` : "N/A"}
              </span>
            </div>
            <div className="detail-item">
              <strong className="text-secondary">Studios:</strong>{" "}
              <span className="text-text-light">
                {anime.studios && anime.studios.length > 0
                  ? anime.studios.join(", ")
                  : "N/A"}{" "}
              </span>
            </div>
          </div>
          <div className="mt-6">
            <label htmlFor="userAnimeStatus" className="block text-text-light text-sm font-bold mb-2">
              Set Watchlist Status:
            </label>
            <select
              id="userAnimeStatus"
              name="userAnimeStatus"
              value={userAnimeStatus}
              onChange={(e) => setUserAnimeStatus(e.target.value as AnimeStatus)}
              className="block w-full bg-card border border-gray-300 text-text py-2 px-3 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
            >
              {Object.values(AnimeStatus).map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAddToWatchlist}
            className="mt-4 w-full rounded-lg bg-accent px-6 py-3 text-lg font-semibold text-white shadow-md transition duration-300 ease-in-out hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-accent focus:ring-opacity-75"
          >
            Add to Watchlist
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnimeDetails;
