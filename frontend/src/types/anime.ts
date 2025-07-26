import type { Dispatch, SetStateAction } from "react";

export type Title = {
  romaji: string;
  english: string;
  display_romaji: string;
  display_english: string;
};

export type CoverImage = {
  large: string;
};

export type Anime = {
  id?: number;
  title: Title;
  description?: string;
  genres: Array<string>;
  averageScore?: number;
  coverImage?: CoverImage;
  embedding: Array<number>;
};

export type AnimeOut = {
  id?: number;
  title: Title;
  description?: string;
  genres: Array<string>;
  averageScore?: number;
  episodes?: number;
  duration?: number;
  season?: string;
  seasonYear?: number;
  status?: string;
  source?: string;
  studios: Array<string>;
  coverImage?: CoverImage;
};

export type AnimeResponse = {
  anime: AnimeOut;
};

export type AnimeListResponse = {
  results: Array<AnimeOut>;
};

export type AnimesListResponse = {
  results: Array<AnimeOut>;
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export type GenresResponse = {
  genres: Array<string>;
};

export type MessageResponse = {
  message: string;
};

export type ChatbotResponse = {
  results: string;
};

export enum QueryMode {
  anime_name = "anime_name",
  genre = "genre",
  description = "description",
}

export type RecommendationsParams = {
  query: string;
  mode: QueryMode;
  top_k: number;
};

export type Filters = {
  searchQuery: string;
  selectedGenre?: string;
  minScore?: number;
  maxScore?: number;
  season?: string;
  year?: number;
};

export type AnimeFiltersProps = {
  filters: Filters;
  setFilters: Dispatch<SetStateAction<Filters>>;
};
