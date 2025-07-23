import { Link } from "react-router-dom";
import type { AnimeOut } from "../types/anime";

export const AnimeCard = ({ anime }: { anime: AnimeOut }) => {
  return (
    <Link to={`/anime/${anime.title.romaji}`}>
      <div className="bg-card text-text rounded-xl shadow-lg p-5 mb-6 hover:shadow-2xl hover:-translate-y-2 hover:border-primary border border-transparent transition-all duration-300 transform group">
        <div className="relative overflow-hidden rounded-lg mb-4">
          <img
            src={anime.coverImage?.large}
            alt={anime.title.english || anime.title.romaji}
            className="w-full h-72 object-cover rounded-lg transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
            <h3 className="text-xl font-bold text-white leading-tight">
              {anime.title.display_english || anime.title.display_romaji}
            </h3>
          </div>
        </div>
        <p className="text-sm text-text-light leading-relaxed">
          {anime.description?.slice(0, 120)}...
        </p>
      </div>
    </Link>
  );
};
