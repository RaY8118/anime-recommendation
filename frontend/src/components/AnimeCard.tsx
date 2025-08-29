import { Link } from "react-router-dom";
import type { AnimeOut } from "../types/anime";
import { Button } from '@headlessui/react';
import { TrashIcon } from '@heroicons/react/24/solid';

export const AnimeCard = ({
  anime,
  onDelete,
}: {
  anime: AnimeOut;
  onDelete?: () => void;
}) => {
  return (
    <div className="bg-black/20 backdrop-blur-xl text-text rounded-xl shadow-lg p-5 mb-6 hover:shadow-2xl hover:-translate-y-2 hover:border-primary border border-white/10 transition-all duration-300 transform group relative">
      {/* Delete button outside of the Link */}
      {onDelete && (
        <Button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-2 right-2 inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-inner shadow-white/10 focus:not-data-focus:outline-none data-focus:outline data-focus:outline-white data-hover:bg-red-700 data-open:bg-red-600 z-20"
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      )}

      {/* Link only wraps the anime content */}
      <Link to={`/anime/${anime.title.romaji}`}>
        <div className="relative overflow-hidden rounded-lg mb-4">
          <img
            src={anime.coverImage?.large}
            alt={anime.title.english || anime.title.romaji}
            loading="lazy"
            className="w-full h-72 object-cover rounded-lg transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
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
