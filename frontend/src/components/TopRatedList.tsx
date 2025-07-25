import { Link } from "react-router-dom";
import type { AnimeOut } from "../types/anime";

interface TopRatedListProps {
  animes: AnimeOut[];
}

const TopRatedList = ({ animes }: TopRatedListProps) => {
  return (
    <div className="w-full max-w-md mx-auto">
      <ul className="space-y-2">
        {animes.map((anime, index) => (
          <li key={anime.id}>
            <Link
              to={`/anime/${anime.title.romaji || anime.title.english}`}
              className="flex items-center font-black justify-between px-4 py-2 rounded-lg bg-primary shadow-md hover:bg-secondary transition duration-300 ease-in-out hover:ring-2 hover:ring-blue-500 hover:ring-opacity-75"
            >
              <span className="font-medium text-text-dark">
                {index + 1}.{" "}
                {anime.title.display_english || anime.title.display_romaji}
              </span>
              <span className="text-sm text-text-light">
                {anime.averageScore ? `${anime.averageScore}/100` : "N/A"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TopRatedList;
