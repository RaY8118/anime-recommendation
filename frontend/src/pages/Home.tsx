import { useQuery } from "@tanstack/react-query";
import { AnimeCard } from "../components/AnimeCard";
import { Error } from "../components/Error";
import GenreHighlights from "../components/GenreHighlights";
import { Loader } from "../components/Loader";
import TopRatedList from "../components/TopRatedList";
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
      const res = await getTopRated(10);
      return res.data.results;
    },
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="container mx-auto px-4 py-10">
      {/* Hero Title */}
      <h1 className="mb-10 text-center text-5xl font-extrabold text-primary drop-shadow-lg">
        Welcome to NekoRec
      </h1>

      {/* Anime of the Moment */}
      <section className="mb-16">
        <h2 className="mb-8 text-center text-4xl font-bold text-accent">
          Anime of the Moment
        </h2>
        {loadingRandom && <Loader />}
        {errorRandom && <Error message={(randomError as Error).message} />}
        {randomAnime && (
          <div className="flex justify-center">
            <AnimeCard anime={randomAnime} />
          </div>
        )}
      </section>

      {/* Top Rated Animes */}
      <section className="mb-16">
        <h2 className="mb-8 text-center text-4xl font-bold text-primary">
          Top Rated Animes
        </h2>
        {loadingTopRated && <Loader />}
        {errorTopRated && <Error message={(topRatedError as Error).message} />}
        {topRated && <TopRatedList animes={topRated} />}
      </section>

      {/* Genre Highlights */}
      <section className="space-y-16">
        <GenreHighlights genre="Action" />
        <GenreHighlights genre="Romance" />
        <GenreHighlights genre="Comedy" />
        <GenreHighlights genre="Adventure" />
      </section>
    </div>
  );
};

export default Home;
