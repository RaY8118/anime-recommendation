import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getAnimeByName, type AnimeOut } from "../services/api";
import { Loader } from "../components/Loader";
import { Error } from "../components/Error";

const AnimeDetails = () => {
  const { name } = useParams();
  const [anime, setAnime] = useState<AnimeOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnime = async () => {
      try {
        if (name) {
          const response = await getAnimeByName(name);
          setAnime(response.data.anime);
        }
      } catch (error) {
        console.error("Error fetching anime details: ", error);
        setError("Failed to fetch anime details.");
      } finally {
        setLoading(false);
      }
    };
    fetchAnime();
  }, [name]);

  if (loading) return <Loader />;
  if (error) return <Error message={error} />;

  if (!anime) return <Error message="Anime not found" />;
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col md:flex-row gap-8 items-center md:items-start">
        <img
          src={anime.coverImage?.large}
          alt={anime.title.romaji}
          className="w-full md:w-1/3 lg:w-1/4 rounded-lg shadow-md object-cover"
        />
        <div className="flex-1 text-white">
          <h1 className="text-4xl font-bold mb-4 text-blue-400">
            {anime.title.english || anime.title.romaji}
          </h1>
          {anime.title.english && (
            <h2 className="text-xl text-gray-300 mb-4">
              ({anime.title.romaji})
            </h2>
          )}
          <p className="text-gray-300 mb-4 leading-relaxed">
            {anime.description}
          </p>
          <div className="mb-2">
            <strong className="text-blue-300">Genres:</strong>{" "}
            <span className="text-gray-300">{anime.genres.join(", ")}</span>
          </div>
          <div className="mb-2">
            <strong className="text-blue-300">Average Score:</strong>{" "}
            <span className="text-gray-300">
              {anime.averageScore ? `${anime.averageScore}%` : "N/A"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimeDetails;
