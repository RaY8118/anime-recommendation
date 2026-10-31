const ADULT_GENRES = ["hentai", "ecchi"];

export const isAdultGenre = (genre?: string | null): boolean =>
  !!genre && ADULT_GENRES.includes(genre.trim().toLowerCase());

export const isAdultAnime = (
  genres?: string[] | null,
  isAdult?: boolean | null
): boolean => isAdult === true || (genres ?? []).some(isAdultGenre);
