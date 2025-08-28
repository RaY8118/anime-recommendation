import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Error as ErrorComponent } from "../components/Error";
import { Loader } from "../components/Loader";
import {
  getAnimeByName,
  addToWatchlist,
  updateWatchlistStatus,
  deleteFromWatchlist,
  getWatchlistItem,
} from "../services/api";
import { AnimeStatus } from "../types/anime";
import type { AnimeOut } from "../types/anime";
import type { WatchlistAnimeOut } from "../types/watchlist";
import { useAuth0 } from "@auth0/auth0-react";
import { useState, useEffect } from "react";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";

const AnimeDetails = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  const [userAnimeStatus, setUserAnimeStatus] = useState<AnimeStatus>(
    AnimeStatus.PLANNED
  );

  // --- Fetch anime details ---
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
      return response.data.anime as AnimeOut;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!name,
  });

  // --- Fetch single watchlist item (if logged in) ---
  const { data: watchlistItem, isLoading: watchlistLoading } = useQuery({
    queryKey: ["watchlist", animeResponse?.id],
    queryFn: async () => {
      const token = await getAccessTokenSilently();
      const res = await getWatchlistItem(String(animeResponse!.id), token);
      return res.data as WatchlistAnimeOut | null;
    },
    enabled: isAuthenticated && !!animeResponse?.id,
  });

  // update state when we get user status
  useEffect(() => {
    if (watchlistItem?.user_anime_status) {
      setUserAnimeStatus(watchlistItem.user_anime_status as AnimeStatus);
    }
  }, [watchlistItem]);

  // --- Mutation: Add ---
  const addMutation = useMutation({
    mutationFn: async () => {
      if (!animeResponse?.id) throw new Error("Anime ID not available");
      const token = await getAccessTokenSilently();
      return addToWatchlist(String(animeResponse.id), userAnimeStatus, token);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["watchlist", animeResponse?.id],
      }),
  });

  // --- Mutation: Update ---
  const updateMutation = useMutation({
    mutationFn: async (newStatus: AnimeStatus) => {
      if (!animeResponse?.id) throw new Error("Anime ID not available");
      const token = await getAccessTokenSilently();
      return updateWatchlistStatus(String(animeResponse.id), newStatus, token);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["watchlist", animeResponse?.id],
      }),
  });

  // --- Mutation: Delete ---
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!animeResponse?.id) throw new Error("Anime ID not available");
      const token = await getAccessTokenSilently();
      return deleteFromWatchlist(String(animeResponse.id), token);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["watchlist", animeResponse?.id],
      }),
  });

  if (isLoading || (isAuthenticated && watchlistLoading)) return <Loader />;
  if (isError) return <ErrorComponent message={(error as Error).message} />;
  if (!animeResponse) return <ErrorComponent message="Anime not found" />;

  const anime = animeResponse;

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
          {/* Title + Watchlist actions row */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-extrabold text-primary drop-shadow-md lg:text-4xl">
              {anime.title.display_english || anime.title.display_romaji}
            </h1>

            {isAuthenticated && (
              <div className="flex items-center gap-2">
                {!watchlistItem ? (
                  <button
                    onClick={() => addMutation.mutate()}
                    disabled={addMutation.isPending}
                    className="flex items-center gap-1 rounded-md bg-accent px-3 py-1 text-sm font-semibold text-white shadow hover:bg-accent-dark disabled:opacity-50"
                  >
                    <PlusIcon className="h-4 w-4" />
                    {addMutation.isPending ? "Adding..." : "Add"}
                  </button>
                ) : (
                  <>
                    <select
                      value={userAnimeStatus}
                      onChange={(e) =>
                        setUserAnimeStatus(e.target.value as AnimeStatus)
                      }
                      className="rounded-md border border-gray-300 bg-card px-2 py-1 text-sm text-text shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                    >
                      {Object.values(AnimeStatus).map((status) => (
                        <option key={status} value={status}>
                          {status.charAt(0).toUpperCase() +
                            status.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => updateMutation.mutate(userAnimeStatus)}
                      disabled={updateMutation.isPending}
                      className="flex items-center gap-1 rounded-md bg-secondary px-3 py-1 text-sm font-semibold text-white shadow hover:bg-secondary-dark disabled:opacity-50"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                      {updateMutation.isPending ? "..." : "Update"}
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                      className="flex items-center gap-1 rounded-md bg-red-600 px-3 py-1 text-sm font-semibold text-white shadow hover:bg-red-700 disabled:opacity-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                      {deleteMutation.isPending ? "..." : "Remove"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {anime.title.display_english && (
            <h2 className="mb-6 text-xl text-text-light">
              ({anime.title.display_romaji})
            </h2>
          )}

          {/* Description */}
          <p className="mb-6 leading-relaxed text-text-light lg:text-lg">
            {anime.description}
          </p>

          {/* Details Grid */}
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
                  : "N/A"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimeDetails;
