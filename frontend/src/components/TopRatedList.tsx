import { Transition } from "@headlessui/react";
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
          <Transition
            key={anime.id}
            show={true}
            enter="transition-opacity duration-75"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <li>
              <Link
                to={`/anime/${anime.id}`}
                className="group flex items-center justify-between gap-3 rounded-xl glass px-4 py-2 shadow-sm transition duration-300 ease-in-out hover:border-primary hover:shadow-lg hover:shadow-primary/20"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-white shadow-sm shadow-primary/40">
                    {index + 1}
                  </span>
                  <span className="truncate font-medium text-text">
                    {anime.title.display_english || anime.title.display_romaji}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-text-light">
                  {anime.averageScore ? `${anime.averageScore}/100` : "N/A"}
                </span>
              </Link>
            </li>
          </Transition>
        ))}
      </ul>
    </div>
  );
};

export default TopRatedList;
