import { useState } from "react";
import { suggestAnime } from "../services/api";
import { Error } from "../components/Error";
const SuggestAnime = () => {
  const [animeName, setAnimeName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await suggestAnime(animeName);
      console.log(response.data);
      setSuccess(true);
      setAnimeName("");
    } catch (err: any) {
      console.error("Error suggesting anime:", err);
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Failed to suggest anime. Please try again.");
      }
    } finally {
      setLoading(false);
    }
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
        {success && (
          <div className="bg-green-500 text-white p-3 rounded-md mb-4 text-center">
            Anime suggestion submitted successfully!
          </div>
        )}
        {error && <Error message={error} />}

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
          disabled={loading}
        >
          {loading ? "Submitting..." : "Suggest Anime"}
        </button>
      </form>
    </div>
  );
};
export default SuggestAnime;
