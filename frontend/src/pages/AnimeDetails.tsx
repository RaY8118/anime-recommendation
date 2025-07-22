import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Error as ErrorComponent } from "../components/Error";
import { Loader } from "../components/Loader";
import { getAnimeByName } from "../services/api";
import type { AnimeOut } from "../types/anime";

const AnimeDetails = () => {
  const { name } = useParams();

  const {
    data: animeResponse,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["animeDetails", name],
    queryFn: async () => {
      if (!name) throw new Error("Anime name is missing");
      const response = await getAnimeByName(name);
      return response.data.anime;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!name,
  });

  if (isLoading) return <Loader />;
  if (isError) return <ErrorComponent message={(error as Error).message} />;
  if (!animeResponse) return <ErrorComponent message="Anime not found" />;

  const anime: AnimeOut = animeResponse;

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
            {anime.title.display_english || anime.title.display_romaji}
          </h1>
          {anime.title.display_english && (
            <h2 className="text-xl text-gray-300 mb-4">
              ({anime.title.display_romaji})
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
