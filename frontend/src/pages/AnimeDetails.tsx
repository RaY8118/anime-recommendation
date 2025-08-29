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
import { Button, Listbox } from "@headlessui/react";
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
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: "openid profile email",
        },
      });
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
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: "openid profile email",
        },
      });
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
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: "openid profile email",
        },
      });
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
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: "openid profile email",
        },
      });
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

      <div className="flex flex-col gap-8 rounded-xl bg-black/20 backdrop-blur-xl border border-white/10 p-8 shadow-xl lg:flex-row">
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
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <Button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 rounded-md bg-gray-700 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-inner shadow-white/10 focus:not-data-focus:outline-none data-focus:outline data-focus:outline-white data-hover:bg-gray-600 data-open:bg-gray-700"
              >
                &larr; Back
              </Button>

              {isAuthenticated && (
                <div className="flex items-center gap-2">
                  {!watchlistItem ? (
                    <Button
                      onClick={() => addMutation.mutate()}
                      disabled={addMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm/6 font-semibold text-white shadow-inner shadow-white/10 focus:not-data-focus:outline-none data-focus:outline data-focus:outline-white data-hover:bg-accent-dark data-open:bg-accent disabled:opacity-50"
                    >
                      <PlusIcon className="h-4 w-4" />
                      {addMutation.isPending ? "Adding..." : "Add"}
                    </Button>
                  ) : (
                    <>
                      <Listbox value={userAnimeStatus} onChange={setUserAnimeStatus}>
                        <div className="relative">
                          <Listbox.Button className="inline-flex items-center rounded-md border border-gray-300 bg-card px-2 py-1.5 text-sm/6 text-text shadow-inner shadow-white/10 focus:not-data-focus:outline-none data-focus:outline data-focus:outline-white min-w-max">
                            {userAnimeStatus.charAt(0).toUpperCase() + userAnimeStatus.slice(1).toLowerCase()}
                          </Listbox.Button>
                          <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-card py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm min-w-max">
                            {Object.values(AnimeStatus).map((status) => (
                              <Listbox.Option
                                key={status}
                                className={({ active }) =>
                                  `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? 'bg-primary text-white' : 'text-text'
                                  }`
                                }
                                value={status}
                              >
                                {({ selected }) => (
                                  <>
                                    <span
                                      className={`block truncate ${selected ? 'font-medium' : 'font-normal'
                                        }`}
                                    >
                                      {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
                                    </span>
                                    {selected ? (
                                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary">
                                        {/* Checkmark icon */}
                                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.052-.143z" clipRule="evenodd" />
                                        </svg>
                                      </span>
                                    ) : null}
                                  </>
                                )}
                              </Listbox.Option>
                            ))}
                          </Listbox.Options>
                        </div>
                      </Listbox>
                      <Button
                        onClick={() => updateMutation.mutate(userAnimeStatus)}
                        disabled={updateMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-sm/6 font-semibold text-white shadow-inner shadow-white/10 focus:not-data-focus:outline-none data-focus:outline data-focus:outline-white data-hover:bg-secondary-dark data-open:bg-secondary disabled:opacity-50"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                        {updateMutation.isPending ? "..." : "Update"}
                      </Button>
                      <Button
                        onClick={() => deleteMutation.mutate()}
                        disabled={deleteMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-inner shadow-white/10 focus:not-data-focus:outline-none data-focus:outline data-focus:outline-white data-hover:bg-red-700 data-open:bg-red-600 disabled:opacity-50"
                      >
                        <TrashIcon className="h-4 w-4" />
                        {deleteMutation.isPending ? "..." : "Remove"}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
            <h1 className="text-3xl font-extrabold text-primary drop-shadow-md lg:text-4xl">
              {anime.title.display_english || anime.title.display_romaji}
            </h1>
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
