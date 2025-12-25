import type { AxiosResponse } from "axios";
import axios from "axios";
import type {
  AnimeListResponse,
  AnimeResponse,
  AnimesListResponse,
  ChatbotResponse,
  GenresResponse,
  MessageResponse,
  RecommendationsParams,
} from "../types/anime";
import type { WatchlistAnimeOut, WatchlistResponse } from "../types/watchlist";
const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const pingServer = async (): Promise<AxiosResponse<MessageResponse>> => {
  return api.get(`${API_URL}/v1/ping`);
};

export const pingPrivateServer = async (
  token: string
): Promise<AxiosResponse<MessageResponse>> => {
  return axios.get(`${API_URL}/v1/ping/private`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const getAllAnimes = async (
  page: number,
  perPage: number = 12,
  filters: {
    genre?: string;
    min_score?: number;
    max_score?: number;
    season?: string;
    year?: number;
    query?: string;
  }
): Promise<AnimesListResponse> => {
  const response = await api.get(`${API_URL}/v1/animes`, {
    params: {
      page,
      per_page: perPage,
      ...filters,
    },
  });
  return response.data;
};

export const getAnimeByName = async (
  name: string
): Promise<AxiosResponse<AnimeResponse>> => {
  return api.get(`${API_URL}/v1/animes/${name}`);
};

export const getRecommendations = async (
  recommendations: RecommendationsParams
): Promise<AxiosResponse<AnimeListResponse>> => {
  return api.post(`${API_URL}/v1/animes/recommendations`, null, {
    params: {
      query: recommendations.query,
      mode: recommendations.mode,
      top_k: recommendations.top_k,
    },
  });
};

export const getGenres = async (): Promise<AxiosResponse<GenresResponse>> => {
  return api.get(`${API_URL}/v1/animes/genres`);
};

export const filterByGenre = async (
  genre: string,
  page = 1,
  limit = 10
): Promise<AxiosResponse<AnimeListResponse>> => {
  return api.get(`${API_URL}/v1/animes/filter`, {
    params: {
      genre,
      page,
      limit,
    },
  });
};

export const searchAnime = async (
  query: string
): Promise<AxiosResponse<AnimeListResponse>> => {
  return api.get(`${API_URL}/v1/animes/search`, {
    params: {
      query: query,
    },
  });
};

export const suggestAnime = async (
  anime_name: string
): Promise<AxiosResponse<MessageResponse>> => {
  return api.post(`${API_URL}/v1/animes/suggestions`, null, {
    params: {
      anime_name: anime_name,
    },
  });
};

export const getRandomAnime = async (): Promise<
  AxiosResponse<AnimeResponse>
> => {
  return api.get(`${API_URL}/v1/animes/random`);
};

export const getTopRated = async (
  limit: number
): Promise<AxiosResponse<AnimeListResponse>> => {
  return api.get(`${API_URL}/v1/animes/top-rated`, {
    params: {
      limit: limit,
    },
  });
};

export const getChatbotModels = async () => {
  return api.get(`${API_URL}/v1/animes/chatbot/models`);
};

export const sendChatMessage = async (
  message: string,
  model_id: string = "mistralai/devstral-2512:free"
): Promise<AxiosResponse<ChatbotResponse>> => {
  return api.post(`${API_URL}/v1/animes/chatbot`, { message, model_id });
};

export const getWatchlist = async (
  token: string
): Promise<AxiosResponse<WatchlistAnimeOut[]>> => {
  return api.get(`${API_URL}/v1/watchlist`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const addToWatchlist = async (
  anime_id: string,
  user_anime_status: string,
  token: string
): Promise<AxiosResponse<WatchlistResponse>> => {
  return api.post(
    `${API_URL}/v1/watchlist/add`,
    {},
    {
      params: {
        anime_id: anime_id,
        user_anime_status: user_anime_status,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};

export const getWatchlistItem = async (
  anime_id: string,
  token: string
): Promise<AxiosResponse<WatchlistAnimeOut | null>> => {
  return api.get(`${API_URL}/v1/watchlist/${anime_id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const deleteFromWatchlist = async (
  anime_id: string,
  token: string
): Promise<AxiosResponse<WatchlistResponse>> => {
  return api.delete(`${API_URL}/v1/watchlist/${anime_id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const updateWatchlistStatus = async (
  anime_id: string,
  user_anime_status: string,
  token: string
): Promise<AxiosResponse<WatchlistResponse>> => {
  return api.put(
    `${API_URL}/v1/watchlist/${anime_id}`,
    {},
    {
      params: {
        new_status: user_anime_status,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};
