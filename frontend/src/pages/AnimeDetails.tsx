import { useAuth0 } from "@auth0/auth0-react";
import { Button, Listbox } from "@headlessui/react";
import {
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import {
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ClockIcon,
  DocumentTextIcon,
  FilmIcon,
  ShieldExclamationIcon,
  SignalIcon,
  TagIcon,
} from "@heroicons/react/24/outline";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Error as ErrorComponent } from "../components/Error";
import { Loader } from "../components/Loader";
import { useSfw } from "../context/SfwContext";
import { isAdultAnime } from "../lib/sfw";
import {
  addToWatchlist,
  deleteFromWatchlist,
  getAnimeById,
  getWatchlistItem,
  updateWatchlistStatus,
} from "../services/api";
import type { AnimeOut } from "../types/anime";
import { AnimeStatus } from "../types/anime";
import type { WatchlistAnimeOut } from "../types/watchlist";

const ScoreRing = ({ score }: { score: number }) => {
  const pct = Math.max(0, Math.min(100, score));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-primary)" />
            <stop offset="100%" stopColor="var(--color-accent)" />
          </linearGradient>
        </defs>
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="7"
          style={{ stroke: "var(--color-border)" }}
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-text">{score}</span>
        <span className="text-[10px] uppercase tracking-wide text-text-light">
          score
        </span>
      </div>
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) => (
  <div className="flex items-start gap-3 rounded-xl glass p-4">
    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
      {icon}
    </span>
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-text-light">{label}</p>
      <p className="text-sm text-text">{value}</p>
    </div>
  </div>
);

const AnimeDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const { isSfw, toggleSfw } = useSfw();

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
    queryKey: ["animeDetails", id, isSfw],
    queryFn: async () => {
      if (!id) throw new Error("Anime name is missing");
      const response = await getAnimeById(Number(id), isSfw);
      return response.data.anime as AnimeOut;
    },
    staleTime: 1000 * 60 * 5,
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

  if (isSfw && isAdultAnime(anime.genres, anime.isAdult)) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-md rounded-2xl glass p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <ShieldExclamationIcon className="h-7 w-7" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-text">
            Hidden by SFW mode
          </h2>
          <p className="mb-6 text-text-light">
            This anime is hidden while SFW mode is on.
          </p>
          <button
            onClick={toggleSfw}
            className="w-full rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 font-semibold text-white shadow-md shadow-primary/30 transition-all duration-300 hover:brightness-110"
          >
            Turn off SFW mode
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="relative">
        {/* Blurred cover backdrop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
        >
          <img
            src={anime.coverImage?.large}
            alt=""
            className="h-full w-full scale-110 object-cover opacity-25 blur-3xl saturate-150"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background" />
        </div>

        <div className="relative z-10 flex flex-col gap-8 rounded-2xl glass p-8 shadow-xl lg:flex-row">
        {/* Anime Cover Image */}
        <div className="flex-shrink-0 lg:w-1/3">
          <img
            src={anime.coverImage?.large}
            alt={anime.title.romaji}
            className="w-full rounded-2xl object-cover shadow-2xl shadow-primary/20"
          />
        </div>

        {/* Anime Details */}
        <div className="flex-1 text-text">
          {/* Title + Watchlist actions row */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <Button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm font-semibold text-text shadow-inner shadow-white/10 transition-colors data-hover:bg-primary/20 focus:outline-none"
              >
                &larr; Back
              </Button>

              {isAuthenticated && (
                <div className="flex items-center gap-2">
                  {!watchlistItem ? (
                    <Button
                      onClick={() => addMutation.mutate()}
                      disabled={addMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-sm font-semibold text-white shadow-md shadow-primary/30 transition-all data-hover:brightness-110 disabled:opacity-50"
                    >
                      <PlusIcon className="h-4 w-4" />
                      {addMutation.isPending ? "Adding..." : "Add"}
                    </Button>
                  ) : (
                    <>
                      <Listbox
                        value={userAnimeStatus}
                        onChange={setUserAnimeStatus}
                      >
                        <div className="relative">
                          <Listbox.Button className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1.5 text-sm text-text shadow-inner shadow-white/10 transition-colors data-hover:border-primary focus:outline-none min-w-max">
                            {userAnimeStatus.charAt(0).toUpperCase() +
                              userAnimeStatus.slice(1).toLowerCase()}
                          </Listbox.Button>
                          <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl glass py-1 text-base shadow-lg ring-1 ring-border focus:outline-none sm:text-sm min-w-max">
                            {Object.values(AnimeStatus).map((status) => (
                              <Listbox.Option
                                key={status}
                                className={({ active }) =>
                                  `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                    active
                                      ? "bg-primary text-white"
                                      : "text-text"
                                  }`
                                }
                                value={status}
                              >
                                {({ selected }) => (
                                  <>
                                    <span
                                      className={`block truncate ${
                                        selected ? "font-medium" : "font-normal"
                                      }`}
                                    >
                                      {status.charAt(0).toUpperCase() +
                                        status.slice(1).toLowerCase()}
                                    </span>
                                    {selected ? (
                                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary">
                                        {/* Checkmark icon */}
                                        <svg
                                          className="h-5 w-5"
                                          viewBox="0 0 20 20"
                                          fill="currentColor"
                                          aria-hidden="true"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.052-.143z"
                                            clipRule="evenodd"
                                          />
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
                        className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold text-white shadow-inner shadow-white/10 transition-colors data-hover:bg-secondary-dark disabled:opacity-50"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                        {updateMutation.isPending ? "..." : "Update"}
                      </Button>
                      <Button
                        onClick={() => deleteMutation.mutate()}
                        disabled={deleteMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-full bg-red-500/90 px-3 py-1.5 text-sm font-semibold text-white shadow-inner shadow-white/10 transition-colors data-hover:bg-red-500 disabled:opacity-50"
                      >
                        <TrashIcon className="h-4 w-4" />
                        {deleteMutation.isPending ? "..." : "Remove"}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
            <h1 className="text-3xl font-extrabold gradient-text lg:text-4xl">
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

          {/* Score + Details */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            {anime.averageScore ? (
              <ScoreRing score={anime.averageScore} />
            ) : null}
            <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                icon={<TagIcon className="h-5 w-5" />}
                label="Genres"
                value={anime.genres.length ? anime.genres.join(", ") : "N/A"}
              />
              <StatCard
                icon={<FilmIcon className="h-5 w-5" />}
                label="Episodes"
                value={anime.episodes ? `${anime.episodes}` : "N/A"}
              />
              <StatCard
                icon={<ClockIcon className="h-5 w-5" />}
                label="Duration"
                value={anime.duration ? `${anime.duration} min` : "N/A"}
              />
              <StatCard
                icon={<CalendarDaysIcon className="h-5 w-5" />}
                label="Season"
                value={`${anime.season ?? "N/A"} (${anime.seasonYear ?? "N/A"})`}
              />
              <StatCard
                icon={<SignalIcon className="h-5 w-5" />}
                label="Status"
                value={anime.status ?? "N/A"}
              />
              <StatCard
                icon={<DocumentTextIcon className="h-5 w-5" />}
                label="Source"
                value={anime.source ?? "N/A"}
              />
              <StatCard
                icon={<BuildingOffice2Icon className="h-5 w-5" />}
                label="Studios"
                value={
                  anime.studios && anime.studios.length > 0
                    ? anime.studios.join(", ")
                    : "N/A"
                }
              />
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default AnimeDetails;
