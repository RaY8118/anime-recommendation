import { useMutation } from "@tanstack/react-query";
import type { AxiosError, AxiosResponse } from "axios";
import { useState } from "react";
import { Error } from "../components/Error";
import { suggestAnime } from "../services/api";
import type { MessageResponse } from "../types/anime";

const SuggestAnime = () => {
  const [animeName, setAnimeName] = useState("");

  const { mutate, isPending, isError, isSuccess, error } = useMutation<
    AxiosResponse<MessageResponse>,
    AxiosError,
    string
  >({
    mutationFn: suggestAnime,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (animeName) {
      mutate(animeName);
      setAnimeName("");
    }
  };

  const getErrorMessage = () => {
    if (!error) return "An unexpected error occurred.";

    if (error.response?.status === 409) {
      return `${animeName} already exists in the database.`;
    }

    return error.message || "An unexpected error occurred.";
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Suggest a New Anime
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-4 max-w-lg mx-auto"
      >
        {isSuccess && (
          <div className="bg-green-500 text-white p-3 rounded-md mb-4 text-center">
            Anime suggestion submitted successfully!
          </div>
        )}
        {isError && <Error message={getErrorMessage()} />}

        <div>
          <label
            htmlFor="animeName"
            className="block mb-2 text-lg font-semibold text-gray-300"
          >
            Anime Name
          </label>
          <input
            id="animeName"
            type="text"
            value={animeName}
            onChange={(e) => setAnimeName(e.target.value)}
            className="w-full px-4 py-2 rounded-md bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            placeholder="e.g., Naruto"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 ease-in-out"
          disabled={isPending}
        >
          {isPending ? "Submitting..." : "Suggest Anime"}
        </button>
      </form>
    </div>
  );
};

export default SuggestAnime;
