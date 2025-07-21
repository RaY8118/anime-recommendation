import { useEffect, useState } from "react";
import { getRandomAnime, getTopRated, type AnimeOut } from "../services/api";
import { Loader } from "../components/Loader";
import { Error } from "../components/Error";
import { AnimeCard } from "../components/AnimeCard";

const Home = () => {
  const [randomAnime, setRandomAnime] = useState<AnimeOut | null>(null);
  const [topRated, setTopRated] = useState<AnimeOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);

      const randomResponse = await getRandomAnime();
      setRandomAnime(randomResponse.data.anime);

      const topRatedResponse = await getTopRated(4);
      setTopRated(topRatedResponse.data.results);
    } catch (error) {
      console.error(error);
      setError("Failed to fetch anime data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <Loader />;
  if (error) return <Error message={error} />;

  return (
    <div className="container mx-auto px-4 py-8 mt-4 bg-gray-900 text-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-6">Welcome to AnimeRechub</h1>

      <section className="mb-12 flex justify-center">
        <div className="w-full md:w-3/4 lg:w-1/2">
          {randomAnime && <AnimeCard anime={randomAnime} />}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Top Rated Animes</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {topRated.map((anime) => (
            <AnimeCard key={anime.id} anime={anime} />
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;
