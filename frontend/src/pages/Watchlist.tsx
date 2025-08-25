import { useEffect, useState } from "react";
import { getWatchlist } from "../services/api";
import { useAuth0 } from "@auth0/auth0-react";
import { AnimeCard } from "../components/AnimeCard";
import { Loader } from "../components/Loader";
import { Error } from "../components/Error";
import type { WatchlistAnimeOut } from "../types/watchlist";

const Watchlist = () => {
  const {
    getAccessTokenSilently,
    isAuthenticated,
    isLoading: authLoading,
  } = useAuth0();
  const [watchlist, setWatchlist] = useState<WatchlistAnimeOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWatchlist = async () => {
      if (!isAuthenticated || authLoading) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const token = await getAccessTokenSilently();
        const response = await getWatchlist(token);
        setWatchlist(response.data);
      } catch (err) {
        console.error("Failed to fetch watchlist:", err);
        setError("Failed to load watchlist. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchWatchlist();
  }, [isAuthenticated, authLoading, getAccessTokenSilently]);

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return <Error message={error} />;
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center text-gray-600 dark:text-gray-400">
        Please log in to view your watchlist.
      </div>
    );
  }

  if (watchlist.length === 0) {
    return (
      <div className="text-center text-gray-600 dark:text-gray-400">
        Your watchlist is empty.
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800 dark:text-white">
        My Watchlist
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {watchlist.map((anime) => (
          <AnimeCard key={anime.id} anime={anime} />
        ))}
      </div>
    </div>
  );
};

export default Watchlist;
