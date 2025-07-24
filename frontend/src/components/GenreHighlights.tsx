import { useQuery } from "@tanstack/react-query";
import { getAllAnimes } from "../services/api";
import { AnimeCard } from "./AnimeCard";
import { Error } from "./Error";
import { Loader } from "./Loader";

const GenreHighlights = ({ genre }: { genre: string }) => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["genreHighlights", genre],
    queryFn: () => getAllAnimes(1, 5, { genre }),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) return <Loader />;
  if (isError) return <Error message={(error as Error).message} />;

  const animes = data?.results || [];

  return (
    <section className="mb-12">
      <h2 className="mb-4 text-3xl font-bold text-accent">
        {genre} Highlights
      </h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {animes.map((anime) => (
          <AnimeCard key={anime.id} anime={anime} />
        ))}
      </div>
    </section>
  );
};

export default GenreHighlights;
