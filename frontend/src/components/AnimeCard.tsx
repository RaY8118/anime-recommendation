import { Button } from "@headlessui/react";
import { TrashIcon } from "@heroicons/react/24/solid";
import { Link } from "react-router-dom";
import type { AnimeOut } from "../types/anime";

export const AnimeCard = ({
  anime,
  onDelete,
}: {
  anime: AnimeOut;
  onDelete?: () => void;
}) => {
  return (
    <div className="group relative mb-6 transform rounded-2xl glass p-5 text-text shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-primary hover:shadow-2xl hover:shadow-primary/20">
      {/* Delete button outside of the Link */}
      {onDelete && (
        <Button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-2 right-2 z-20 inline-flex items-center gap-2 rounded-full bg-red-500/90 px-3 py-1.5 text-sm font-semibold text-white shadow-lg shadow-red-500/30 transition-colors data-hover:bg-red-500 focus:outline-none"
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      )}

      {/* Link only wraps the anime content */}
      <Link to={`/anime/${anime.id}`}>
        <div className="relative overflow-hidden rounded-lg mb-4">
          <img
            src={anime.coverImage?.large}
            alt={anime.title.english || anime.title.romaji}
            loading="lazy"
            className="w-full h-72 object-cover rounded-lg transition-transform duration-300 group-hover:scale-105"
          />
          {typeof anime.averageScore === "number" && anime.averageScore > 0 && (
            <span className="absolute left-3 top-3 z-10 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/15 backdrop-blur-md">
              ★ {anime.averageScore}
            </span>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
            <h3 className="text-xl font-bold text-white leading-tight">
              {anime.title.display_english || anime.title.display_romaji}
            </h3>
          </div>
        </div>
        <p className="text-sm text-text-light leading-relaxed">
          {anime.description?.slice(0, 120)}...
        </p>
      </Link>
    </div>
  );
};
