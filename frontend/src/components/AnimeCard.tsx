import { Link } from "react-router-dom";
import type { AnimeOut } from "../services/api";

export const AnimeCard = ({ anime }: { anime: AnimeOut }) => {
  return (
    <Link to={`/anime/${anime.title.romaji}`}>
      <div className="bg-gray-800 text-white rounded shadow p-4 mb-4 hover:bg-gray-700">
        <img
          src={anime.coverImage?.large}
          alt={anime.title.english || anime.title.romaji}
          className="w-full h-64 object-cover mb-2 rounded"
        />
        <h3 className="text-lg font-medium mb-2">
          {anime.title.english || anime.title.romaji}
        </h3>
        <p className="text-sm">{anime.description?.slice(0, 100)}...</p>
      </div>
    </Link>
  );
};
