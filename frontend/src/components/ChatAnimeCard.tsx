import { Link } from "react-router-dom";
import type { ChatAnime } from "../types/anime";

export const ChatAnimeCard = ({ anime }: { anime: ChatAnime }) => {
  const content = (
    <div className="group flex items-center gap-3 rounded-xl glass border-border p-2 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:shadow-lg hover:shadow-primary/20">
      <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-surface">
        {anime.cover ? (
          <img
            src={anime.cover}
            alt={anime.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-text-light">
            N/A
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text" title={anime.title}>
          {anime.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-text-light">
          {typeof anime.score === "number" && (
            <span className="rounded-full bg-primary/20 px-2 py-0.5 font-medium text-primary">
              ★ {anime.score}
            </span>
          )}
          {anime.year && <span>{anime.year}</span>}
          {anime.genres.length > 0 && (
            <span className="truncate">{anime.genres.join(" · ")}</span>
          )}
        </div>
      </div>
    </div>
  );

  if (anime.id === undefined) {
    return content;
  }

  return (
    <Link to={`/anime/${anime.id}`} className="block">
      {content}
    </Link>
  );
};
