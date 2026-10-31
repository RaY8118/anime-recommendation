import type { AxiosResponse } from "axios";
import axios from "axios";
import type {
  AnimeListResponse,
  AnimeResponse,
  AnimesListResponse,
  ChatAnime,
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
    sfw?: boolean;
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

export const getAnimeById = async (
  id: number,
  sfw: boolean = true
): Promise<AxiosResponse<AnimeResponse>> => {
  return api.get(`${API_URL}/v1/animes/${id}`, {
    params: { sfw },
  });
};

export const getRecommendations = async (
  recommendations: RecommendationsParams
): Promise<AxiosResponse<AnimeListResponse>> => {
  return api.post(`${API_URL}/v1/animes/recommendations`, null, {
    params: {
      query: recommendations.query,
      mode: recommendations.mode,
      top_k: recommendations.top_k,
      sfw: recommendations.sfw ?? true,
    },
  });
};

export const getGenres = async (
  sfw: boolean = true
): Promise<AxiosResponse<GenresResponse>> => {
  return api.get(`${API_URL}/v1/animes/genres`, {
    params: { sfw },
  });
};

export const filterByGenre = async (
  genre: string,
  page = 1,
  limit = 10,
  sfw: boolean = true
): Promise<AxiosResponse<AnimeListResponse>> => {
  return api.get(`${API_URL}/v1/animes/filter`, {
    params: {
      genre,
      page,
      limit,
      sfw,
    },
  });
};

export const searchAnime = async (
  query: string,
  sfw: boolean = true
): Promise<AxiosResponse<AnimeListResponse>> => {
  return api.get(`${API_URL}/v1/animes/search`, {
    params: {
      query: query,
      sfw,
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

export const getRandomAnime = async (
  sfw: boolean = true
): Promise<AxiosResponse<AnimeResponse>> => {
  return api.get(`${API_URL}/v1/animes/random`, {
    params: { sfw },
  });
};

export const getTopRated = async (
  limit: number,
  sfw: boolean = true
): Promise<AxiosResponse<AnimeListResponse>> => {
  return api.get(`${API_URL}/v1/animes/top-rated`, {
    params: {
      limit: limit,
      sfw,
    },
  });
};

export const getChatbotModels = async () => {
  return api.get(`${API_URL}/v1/animes/chatbot/models`);
};

export const sendChatMessage = async (
  message: string,
  model_id: string = "mistralai/devstral-2512:free",
  session_id?: string,
  sfw: boolean = true
): Promise<AxiosResponse<ChatbotResponse>> => {
  return api.post(`${API_URL}/v1/animes/chatbot`, {
    message,
    model_id,
    session_id,
    sfw,
  });
};

export const clearChatHistory = async (
  session_id: string
): Promise<AxiosResponse<MessageResponse>> => {
  return api.post(`${API_URL}/v1/animes/chatbot/clear`, {
    session_id,
  });
};

export type StreamHandlers = {
  onStatus?: (stage: string) => void;
  onToken?: (text: string) => void;
  onSources?: (anime: ChatAnime[]) => void;
  onDone?: (fullText: string) => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
};

const parseSseEvent = (rawEvent: string, handlers: StreamHandlers) => {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of rawEvent.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) return;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(dataLines.join("\n"));
  } catch {
    return;
  }

  switch (event) {
    case "status":
      handlers.onStatus?.(data.stage as string);
      break;
    case "token":
      handlers.onToken?.(data.text as string);
      break;
    case "sources":
      handlers.onSources?.((data.anime as ChatAnime[]) ?? []);
      break;
    case "done":
      handlers.onDone?.((data.text as string) ?? "");
      break;
    case "error":
      handlers.onError?.((data.message as string) ?? "Something went wrong.");
      break;
  }
};

export const streamChatMessage = async (
  message: string,
  model_id: string,
  session_id: string,
  sfw: boolean,
  handlers: StreamHandlers
): Promise<void> => {
  const response = await fetch(`${API_URL}/v1/animes/chatbot/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, model_id, session_id, sfw }),
    signal: handlers.signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Chat stream failed with status ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      parseSseEvent(rawEvent, handlers);
      boundary = buffer.indexOf("\n\n");
    }
  }
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
