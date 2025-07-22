import type { AxiosResponse } from "axios";
import axios from "axios";
import type {
  AnimeListResponse,
  AnimeResponse,
  GenresResponse,
  MessageResponse,
  RecommendationsParams,
} from "../types/anime";
const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const getAllAnimes = async (): Promise<
  AxiosResponse<AnimeListResponse>
> => {
  return api.get(`${API_URL}/animes`);
};

export const getAnimeByName = async (
  name: string
): Promise<AxiosResponse<AnimeResponse>> => {
  return api.get(`${API_URL}/animes/${name}`);
};

export const getRecommendations = async (
  recommendations: RecommendationsParams
): Promise<AxiosResponse<AnimeListResponse>> => {
  return api.post(`${API_URL}/animes/recommendations`, null, {
    params: {
      query: recommendations.query,
      mode: recommendations.mode,
      top_k: recommendations.top_k,
    },
  });
};

export const getGenres = async (): Promise<AxiosResponse<GenresResponse>> => {
  return api.get(`${API_URL}/animes/genres`);
};

export const filterByGenre = async (
  genre: string,
  page = 1,
  limit = 10
): Promise<AxiosResponse<AnimeListResponse>> => {
  return api.get(`${API_URL}/animes/filter`, {
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
  return api.get(`${API_URL}/animes/search`, {
    params: {
      query: query,
    },
  });
};

export const suggestAnime = async (
  anime_name: string
): Promise<AxiosResponse<MessageResponse>> => {
  return api.post(`${API_URL}/animes/suggestions`, null, {
    params: {
      anime_name: anime_name,
    },
  });
};

export const getRandomAnime = async (): Promise<
  AxiosResponse<AnimeResponse>
> => {
  return api.get(`${API_URL}/animes/random`);
};

export const getTopRated = async (
  limit: number
): Promise<AxiosResponse<AnimeListResponse>> => {
  return api.get(`${API_URL}/animes/top-rated`, {
    params: {
      limit: limit,
    },
  });
};
