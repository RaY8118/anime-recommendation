import { useEffect, useState } from "react";
import { getGenres } from "../services/api";
import type { AnimeFiltersProps } from "../types/anime";

export const AnimeFilters = ({ filters, setFilters }: AnimeFiltersProps) => {
  const [genres, setGenres] = useState<string[]>([]);

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await getGenres();
        setGenres(response.data.genres);
      } catch (error) {
        console.error("Error fetching genres:", error);
      }
    };

    fetchGenres();
  }, []);

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

      <select
        value={filters.selectedGenre || ""}
        onChange={(e) =>
          setFilters((prev) => ({
            ...prev,
            selectedGenre: e.target.value || undefined,
          }))
        }
        className="flex-1 min-w-[180px] px-4 py-2 rounded-lg border border-border bg-background/60 text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/60 transition duration-200 ease-in-out"
      >
        <option value="">All Genres</option>
        {genres.map((genre) => (
          <option key={genre} value={genre}>
            {genre}
          </option>
        ))}
      </select>

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
