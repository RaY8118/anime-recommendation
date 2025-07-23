import { useQuery } from "@tanstack/react-query";
import { AnimeCard } from "../components/AnimeCard";
import { Error } from "../components/Error";
import { Loader } from "../components/Loader";
import { getRandomAnime, getTopRated } from "../services/api";

const Home = () => {
  const {
    data: randomAnime,
    isLoading: loadingRandom,
    isError: errorRandom,
    error: randomError,
  } = useQuery({
    queryKey: ["randomAnime"],
    queryFn: async () => {
      const res = await getRandomAnime();
      return res.data.anime;
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const {
    data: topRated,
    isLoading: loadingTopRated,
    isError: errorTopRated,
    error: topRatedError,
  } = useQuery({
    queryKey: ["topRatedAnimes"],
    queryFn: async () => {
      const res = await getTopRated(4);
      return res.data.results;
    },
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="mb-10 text-center text-5xl font-extrabold text-primary drop-shadow-lg">
        Welcome to NekoRec
      </h1>

      <section className="mb-16">
        <h2 className="mb-8 text-center text-4xl font-bold text-accent">Anime of the Moment</h2>
        {loadingRandom && <Loader />}
        {errorRandom && <Error message={(randomError as Error).message} />}
        {randomAnime && (
          <div className="flex justify-center">
            <AnimeCard anime={randomAnime} />
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-8 text-center text-4xl font-bold text-primary">Top Rated Animes</h2>
        {loadingTopRated && <Loader />}
        {errorTopRated && <Error message={(topRatedError as Error).message} />}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {topRated?.map((anime) => (
            <AnimeCard key={anime.id} anime={anime} />
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;
