import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AnimeCard } from "../components/AnimeCard";
import { Error } from "../components/Error";
import GenreHighlights from "../components/GenreHighlights";
import { Loader } from "../components/Loader";
import TopRatedList from "../components/TopRatedList";
import { useSfw } from "../context/SfwContext";
import { getRandomAnime, getTopRated } from "../services/api";
import { Tab } from '@headlessui/react';

const Home = () => {
  const { isSfw } = useSfw();
  const {
    data: randomAnime,
    isLoading: loadingRandom,
    isError: errorRandom,
    error: randomError,
  } = useQuery({
    queryKey: ["randomAnime", isSfw],
    queryFn: async () => {
      const res = await getRandomAnime(isSfw);
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
    queryKey: ["topRatedAnimes", isSfw],
    queryFn: async () => {
      const res = await getTopRated(10, isSfw);
      return res.data.results;
    },
    staleTime: 1000 * 60 * 5,
  });

  const genres = ["Action", "Romance", "Comedy", "Adventure"];

  return (
    <div className="container mx-auto px-4 py-10">
      <section className="mb-16 text-center animate-fade-up">
        <span className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-text-light">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Anime Recommender
        </span>
        <h1 className="mt-6 text-5xl font-extrabold gradient-text md:text-6xl">
          Welcome to NekoRec
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-text-light">
          Discover your next favorite anime — browse a curated library, get
          AI-powered recommendations, and chat with our cat-eared concierge.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/browse"
            className="rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 font-semibold text-white shadow-md shadow-primary/30 transition-all duration-300 hover:brightness-110"
          >
            Browse Anime
          </Link>
          <Link
            to="/recommendations"
            className="rounded-full glass px-6 py-3 font-semibold text-text transition-all duration-300 hover:border-primary hover:text-primary"
          >
            Get Recommendations
          </Link>
        </div>
      </section>

      <section className="mb-16">
        <h2 className="mb-8 text-center text-4xl font-bold gradient-text">
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
        <h2 className="mb-8 text-center text-4xl font-bold gradient-text">
          Top Rated Animes
        </h2>
        {loadingTopRated && <Loader />}
        {errorTopRated && <Error message={(topRatedError as Error).message} />}
        {topRated && <TopRatedList animes={topRated} />}
      </section>

      <section className="mb-16">
        <h2 className="mb-8 text-center text-4xl font-bold gradient-text">
          Explore Genres
        </h2>
        <Tab.Group>
          <Tab.List className="flex space-x-1 rounded-2xl glass p-1">
            {genres.map((genre) => (
              <Tab
                key={genre}
                className={({ selected }) =>
                  `w-full rounded-lg py-2.5 text-sm font-medium leading-5
                  focus:outline-none
                  ${selected
                    ? 'bg-gradient-to-r from-primary to-accent text-white shadow-md shadow-primary/30'
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
                className="rounded-2xl glass p-3 focus:outline-none"
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
