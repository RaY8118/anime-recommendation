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
    <div className="container mx-auto px-4 py-10">
      <h1 className="mb-10 text-center text-5xl font-extrabold text-primary drop-shadow-lg">
        Suggest a New Anime
      </h1>

      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-lg space-y-6 rounded-xl bg-card p-8 shadow-xl"
      >
        {isSuccess && (
          <div className="mb-4 rounded-md bg-secondary p-4 text-center text-lg font-semibold text-background shadow-md">
            Anime suggestion submitted successfully!
          </div>
        )}
        {isError && <Error message={getErrorMessage()} />}

        <div>
          <label
            htmlFor="animeName"
            className="mb-3 block text-2xl font-semibold text-accent"
          >
            Anime Name
          </label>
          <input
            id="animeName"
            type="text"
            value={animeName}
            onChange={(e) => setAnimeName(e.target.value)}
            className="w-full rounded-lg border border-primary bg-background px-5 py-3 text-lg text-text placeholder-text-dark shadow-sm transition-all duration-300 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g., Naruto"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-primary px-6 py-3 text-xl font-bold text-white shadow-md transition-all duration-300 hover:bg-accent"
          disabled={isPending}
        >
          {isPending ? "Submitting..." : "Suggest Anime"}
        </button>
      </form>
    </div>
  );
};

export default SuggestAnime;
