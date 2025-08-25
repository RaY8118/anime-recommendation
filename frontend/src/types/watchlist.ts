import type { AnimeOut } from "../types/anime";

export type WatchlistItem = {
  anime_id: string;
  watched_at: string;
  user_anime_status?: string;
};

export type Watchlist = {
  user_id: string;
  animes: WatchlistItem[];
  updated_at: string;
};

export type WatchlistResponse = {
  watchlist: Watchlist;
};

export type WatchlistAnimeOut = AnimeOut & {
  user_anime_status?: string;
  watched_at: string;
};
