import { deleteFromWatchlist, getWatchlist } from "../services/api";
import { useAuth0 } from "@auth0/auth0-react";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import { AnimeCard } from "../components/AnimeCard";
import { CardGridSkeleton } from "../components/AnimeCardSkeleton";
import { Error } from "../components/Error";
import type { WatchlistAnimeOut } from "../types/watchlist";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tab } from '@headlessui/react';
import { AnimeStatus } from "../types/anime";

const Watchlist = () => {
  const {
    getAccessTokenSilently,
    isAuthenticated,
    isLoading: authLoading,
    loginWithRedirect,
  } = useAuth0();

  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["watchlist"],
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: "openid profile email",
        },
      });
      const res = await getWatchlist(token);
      return res.data;
    },
    enabled: isAuthenticated && !authLoading,
  });

  const handleDeleteWatchlist = useMutation({
    mutationFn: async (anime_id: string) => {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: "openid profile email",
        },
      });
      return deleteFromWatchlist(anime_id, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });
  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-center text-3xl font-bold mb-8 gradient-text">
          My Watchlist
        </h1>
        <CardGridSkeleton
          count={8}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
        />
      </div>
    );
  }

  if (isError) {
    return <Error message="Failed to load watchlist." />;
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-md rounded-2xl glass p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <LockClosedIcon className="h-7 w-7" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-text">
            Your watchlist awaits
          </h2>
          <p className="mb-6 text-text-light">
            Log in to save animes and keep track of what you're watching.
          </p>
          <button
            onClick={() => loginWithRedirect()}
            className="w-full rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 font-semibold text-white shadow-md shadow-primary/30 transition-all duration-300 hover:brightness-110"
          >
            Log in
          </button>
        </div>
      </div>
    );
  }

  const watchlist: WatchlistAnimeOut[] = data || [];

  // Define statuses for tabs
  const statuses = Object.values(AnimeStatus);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-center text-3xl font-bold mb-8 gradient-text">
        My Watchlist
      </h1>

      {watchlist.length === 0 ? (
        <div className="text-center text-text-light">
          Your watchlist is empty.
        </div>
      ) : (
        <Tab.Group>
          <Tab.List className="flex space-x-1 rounded-2xl glass p-1 mb-4">
            {statuses.map((status) => (
              <Tab
                key={status}
                className={({ selected }) =>
                  `w-full rounded-lg py-2.5 text-sm font-medium leading-5
                  focus:outline-none
                  ${selected
                    ? 'bg-gradient-to-r from-primary to-accent text-white shadow-md shadow-primary/30'
                    : 'text-text-light hover:bg-primary/10 hover:text-primary'
                  }`
                }
              >
                {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
              </Tab>
            ))}
          </Tab.List>
          <Tab.Panels>
            {statuses.map((status) => (
              <Tab.Panel
                key={status}
                className="rounded-2xl glass p-3 focus:outline-none"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {watchlist
                    .filter((anime) => anime.user_anime_status === status)
                    .map((anime) => (
                      <AnimeCard
                        key={anime.id}
                        anime={anime}
                        onDelete={() => handleDeleteWatchlist.mutate(String(anime.id))}
                      />
                    ))}
                </div>
              </Tab.Panel>
            ))}
          </Tab.Panels>
        </Tab.Group>
      )}
    </div>
  );
};

export default Watchlist;
