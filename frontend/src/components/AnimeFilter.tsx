import { useEffect, useState } from "react";
import { useSfw } from "../context/SfwContext";
import { isAdultGenre } from "../lib/sfw";
import { getGenres } from "../services/api";
import type { AnimeFiltersProps } from "../types/anime";

export const AnimeFilters = ({ filters, setFilters }: AnimeFiltersProps) => {
  const { isSfw } = useSfw();
  const [genres, setGenres] = useState<string[]>([]);

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await getGenres(isSfw);
        setGenres(response.data.genres);
      } catch (error) {
        console.error("Error fetching genres:", error);
      }
    };

    fetchGenres();
  }, [isSfw]);

  useEffect(() => {
    if (isSfw && isAdultGenre(filters.selectedGenre)) {
      setFilters((prev) => ({ ...prev, selectedGenre: undefined }));
    }
  }, [isSfw, filters.selectedGenre, setFilters]);

  const handleClearFilters = () => {
    setFilters({
      searchQuery: "",
      selectedGenre: undefined,
      minScore: undefined,
      maxScore: undefined,
      season: undefined,
      year: undefined,
    });
  };

  const genrePill = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium transition-colors ${
      active
        ? "bg-gradient-to-r from-primary to-accent text-white shadow-sm shadow-primary/30"
        : "border border-border bg-surface text-text-light hover:border-primary hover:text-primary"
    }`;

  const selectGenre = (genre?: string) =>
    setFilters((prev) => ({
      ...prev,
      selectedGenre: prev.selectedGenre === genre ? undefined : genre,
    }));

  return (
    <div className="mb-8 flex flex-wrap justify-center items-center gap-4 rounded-2xl glass p-4 shadow-lg">
      <input
        type="text"
        value={filters.searchQuery}
        onChange={(e) =>
          setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
        }
        placeholder="Search Anime..."
        className="flex-1 min-w-[180px] px-4 py-2 rounded-lg border border-border bg-background/60 text-text placeholder-text-light focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/60 transition duration-200 ease-in-out"
      />

      <div
        role="radiogroup"
        aria-label="Genre"
        className="flex max-h-32 flex-1 min-w-[180px] flex-wrap gap-1.5 overflow-y-auto pr-1"
      >
        <button
          type="button"
          role="radio"
          aria-checked={!filters.selectedGenre}
          onClick={() => selectGenre(undefined)}
          className={genrePill(!filters.selectedGenre)}
        >
          All
        </button>
        {genres.map((genre) => (
          <button
            key={genre}
            type="button"
            role="radio"
            aria-checked={filters.selectedGenre === genre}
            onClick={() => selectGenre(genre)}
            className={genrePill(filters.selectedGenre === genre)}
          >
            {genre}
          </button>
        ))}
      </div>

      <input
        type="number"
        value={filters.minScore || ""}
        onChange={(e) =>
          setFilters((prev) => ({
            ...prev,
            minScore: e.target.value ? parseInt(e.target.value) : undefined,
          }))
        }
        placeholder="Min Score"
                className="flex-1 min-w-[180px] px-4 py-2 rounded-lg border border-border bg-background/60 text-text placeholder-text-light focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/60 transition duration-200 ease-in-out"
      />

      <input
        type="number"
        value={filters.maxScore || ""}
        onChange={(e) =>
          setFilters((prev) => ({
            ...prev,
            maxScore: e.target.value ? parseInt(e.target.value) : undefined,
          }))
        }
        placeholder="Max Score"
                className="flex-1 min-w-[180px] px-4 py-2 rounded-lg border border-border bg-background/60 text-text placeholder-text-light focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/60 transition duration-200 ease-in-out"
      />

      <select
        value={filters.season || ""}
        onChange={(e) =>
          setFilters((prev) => ({
            ...prev,
            season: e.target.value || undefined,
          }))
        }
        className="flex-1 min-w-[180px] px-4 py-2 rounded-lg border border-border bg-background/60 text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/60 transition duration-200 ease-in-out"
      >
        <option value="">All Seasons</option>
        <option value="WINTER">Winter</option>
        <option value="SPRING">Spring</option>
        <option value="SUMMER">Summer</option>
        <option value="FALL">Fall</option>
      </select>

      <input
        type="number"
        value={filters.year || ""}
        onChange={(e) =>
          setFilters((prev) => ({
            ...prev,
            year: e.target.value ? parseInt(e.target.value) : undefined,
          }))
        }
        placeholder="Year"
        className="flex-1 min-w-[120px] px-4 py-2 rounded-lg border border-border bg-background/60 text-text placeholder-text-light focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/60 transition duration-200 ease-in-out"
      />
      <button
        onClick={handleClearFilters}
        className="rounded-lg bg-gradient-to-r from-primary to-accent px-6 py-2 font-semibold text-white shadow-md shadow-primary/30 transition duration-200 ease-in-out hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-accent/60"
      >
        Clear
      </button>
    </div>
  );
};
