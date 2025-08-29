import { deleteFromWatchlist, getWatchlist } from "../services/api";
import { useAuth0 } from "@auth0/auth0-react";
import { AnimeCard } from "../components/AnimeCard";
import { Loader } from "../components/Loader";
import { Error } from "../components/Error";
import type { WatchlistAnimeOut } from "../types/watchlist";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tab } from '@headlessui/react'; // Import Tab components
import { AnimeStatus } from "../types/anime"; // Ensure this is imported

const Watchlist = () => {
  const {
    getAccessTokenSilently,
    isAuthenticated,
    isLoading: authLoading,
  } = useAuth0();

  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["watchlist"],
    queryFn: async () => {
      const token = await getAccessTokenSilently();
      const res = await getWatchlist(token);
      return res.data;
    },
    enabled: isAuthenticated && !authLoading,
  });

  const handleDeleteWatchlist = useMutation({
    mutationFn: async (anime_id: string) => {
      const token = await getAccessTokenSilently();
      return deleteFromWatchlist(anime_id, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });
  if (isLoading) {
    return <Loader />;
  }

  if (isError) {
    return <Error message="Failed to load watchlist." />;
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center text-gray-600 dark:text-gray-400">
        Please log in to view your watchlist.
      </div>
    );
  }

  const watchlist: WatchlistAnimeOut[] = data || [];

  // Define statuses for tabs
  const statuses = Object.values(AnimeStatus);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800 dark:text-white">
        My Watchlist
      </h1>

      {watchlist.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400">
          Your watchlist is empty.
        </div>
      ) : (
        <Tab.Group>
          <Tab.List className="flex space-x-1 rounded-xl bg-card/50 p-1 mb-4">
            {statuses.map((status) => (
              <Tab
                key={status}
                className={({ selected }) =>
                  `w-full rounded-lg py-2.5 text-sm font-medium leading-5
                  ring-offset-2 focus:outline-none focus:ring-2
                  ${
                    selected
                      ? 'bg-primary text-white shadow ring-primary'
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
                className="rounded-xl bg-card p-3 ring-offset-2 focus:outline-none focus:ring-2 ring-primary"
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
