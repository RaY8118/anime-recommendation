import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Error as ErrorComponent } from "../components/Error";
import { Loader } from "../components/Loader";
import { getAnimeByName } from "../services/api";
import type { AnimeOut } from "../types/anime";

const AnimeDetails = () => {
  const { name } = useParams();
  const navigate = useNavigate();

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
    <div className="container mx-auto px-4 py-10">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 rounded-lg bg-primary px-6 py-2 text-lg font-semibold text-white shadow-md transition duration-300 ease-in-out hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-75"
      >
        &larr; Back
      </button>
      <div className="flex flex-col items-center gap-10 rounded-xl bg-card p-8 shadow-xl md:flex-row md:items-start">
        <img
          src={anime.coverImage?.large}
          alt={anime.title.romaji}
          className="w-full rounded-lg object-cover shadow-lg md:w-1/3 lg:w-1/4"
        />
        <div className="flex-1 text-text">
          <h1 className="mb-3 text-center text-4xl font-extrabold text-primary drop-shadow-md md:text-left lg:text-5xl">
            {anime.title.display_english || anime.title.display_romaji}
          </h1>
          {anime.title.display_english && (
            <h2 className="mb-6 text-center text-xl text-text-light md:text-left lg:text-2xl">
              ({anime.title.display_romaji})
            </h2>
          )}
          <p className="mb-6 leading-relaxed text-text-light lg:text-lg">
            {anime.description}
          </p>
          <div className="mb-3">
            <strong className="text-xl text-secondary">Genres:</strong>{" "}
            <span className="text-lg text-text-light">
              {anime.genres.join(", ")}
            </span>
          </div>
          <div className="mb-3">
            <strong className="text-xl text-secondary">Average Score:</strong>{" "}
            <span className="text-lg text-text-light">
              {anime.averageScore ? `${anime.averageScore}%` : "N/A"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimeDetails;
