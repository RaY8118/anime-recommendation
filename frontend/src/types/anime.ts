export interface Title {
  romaji: string;
  english: string;
  display_romaji: string;
  display_english: string;
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

export interface AnimesListResponse {
  results: Array<AnimeOut>;
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
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
