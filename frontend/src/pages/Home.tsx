import { useQuery } from "@tanstack/react-query";
import { AnimeCard } from "../components/AnimeCard";
import { Error } from "../components/Error";
import GenreHighlights from "../components/GenreHighlights"; // Keep this import
import { Loader } from "../components/Loader";
import TopRatedList from "../components/TopRatedList";
import { getRandomAnime, getTopRated } from "../services/api";
import { Tab } from '@headlessui/react'; // Import Tab components

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

  const genres = ["Action", "Romance", "Comedy", "Adventure"]; // Define genres

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="mb-10 text-center text-5xl font-extrabold text-primary drop-shadow-lg">
        Welcome to NekoRec
      </h1>

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

      <section className="mb-16">
        <h2 className="mb-8 text-center text-4xl font-bold text-primary">
          Top Rated Animes
        </h2>
        {loadingTopRated && <Loader />}
        {errorTopRated && <Error message={(topRatedError as Error).message} />}
        {topRated && <TopRatedList animes={topRated} />}
      </section>

      <section className="mb-16">
        <h2 className="mb-8 text-center text-4xl font-bold text-primary">
          Explore Genres
        </h2>
        <Tab.Group>
          <Tab.List className="flex space-x-1 rounded-xl bg-card/50 p-1">
            {genres.map((genre) => (
              <Tab
                key={genre}
                className={({ selected }) =>
                  `w-full rounded-lg py-2.5 text-sm font-medium leading-5
                  ring-offset-2 focus:outline-none focus:ring-2
                  ${
                    selected
                      ? 'bg-primary text-white shadow ring-primary'
                      : 'text-text-light hover:bg-primary/10 hover:text-primary'
                  }`
                }
              >
                {genre}
              </Tab>
            ))}
          </Tab.List>
          <Tab.Panels className="mt-2">
            {genres.map((genre) => (
              <Tab.Panel
                key={genre}
                className="rounded-xl bg-card p-3 ring-offset-2 focus:outline-none focus:ring-2 ring-primary"
              >
                <GenreHighlights genre={genre} /> {/* Render existing component */}
              </Tab.Panel>
            ))}
          </Tab.Panels>
        </Tab.Group>
      </section>
    </div>
  );
};

export default Home;
