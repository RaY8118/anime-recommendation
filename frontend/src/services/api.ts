import axios from "axios";
import type { AxiosResponse } from "axios";
const API_URL = import.meta.env.VITE_API_URL;

export interface Title {
  romaji: string;
  english: string;
}

export interface CoverImage {
  large: string;
}

export interface Anime {
  id: number;
  title: Title;
  description: string;
  genres: Array<string>;
  averageScore: number;
  coverImage: CoverImage;
  embedding: Array<number>;
}

export interface AnimeOut {
  id: number;
  title: Title;
  description: string;
  genres: Array<string>;
  averageScore: number;
  coverImage: CoverImage;
}

export interface AnimeResponse {
  anime: AnimeOut;
}

export interface AnimeListResponse {
  results: Array<AnimeOut>;
}

export interface GenresResponse {
  genres: Array<string>;
}

export interface MessageResponse {
  message: string;
}

export enum QueryMode {
  anime_name = "anime_name",
  genre = "genre",
  description = "description",
}

export interface RecommendationsParams {
  query: string;
  mode: QueryMode;
  top_k: number;
}

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
