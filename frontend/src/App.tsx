import { useQuery } from "@tanstack/react-query";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import "./App.css";

import Footer from "./components/Footer";
import { Loader } from "./components/Loader";
import Navbar from "./components/Navbar";
import AnimeDetails from "./pages/AnimeDetails";
import Browse from "./pages/Browse";
import Genres from "./pages/Genres";
import Home from "./pages/Home";
import Recommendations from "./pages/Recommendations";
import SuggestAnime from "./pages/SuggestAnime";
import { pingServer } from "./services/api";

function App() {
  const { isLoading, isError, refetch } = useQuery({
    queryKey: ["ping"],
    queryFn: async () => await pingServer(),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <Loader />
          <p className="text-white text-4xl font-extrabold mt-6">
            Waking up server, please wait...
          </p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-screen flex-col gap-2 bg-gray-900">
        <p>Server unavailable. Please try again.</p>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={() => refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-background text-text">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/anime/:name" element={<AnimeDetails />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/genres" element={<Genres />} />
            <Route path="/suggest" element={<SuggestAnime />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
