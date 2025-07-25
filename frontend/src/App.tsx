import { useQuery } from "@tanstack/react-query";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import "./App.css";

import Footer from "./components/Footer";
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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4">
        <div className="text-center">
          <div className="relative w-32 h-32 mx-auto mb-8">
            <img
              src="favicon.png"
              alt="NekoRec Logo"
              className="absolute inset-0 w-full h-full p-2"
            />
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold mb-4 drop-shadow-lg ">
            Waking up the NekoRec Server!
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8 delay-100">
            Please bear with us, this might take a moment...
          </p>

          <div className="mt-8 w-80 md:w-96 mx-auto bg-gray-700 rounded-full h-3 overflow-hidden shadow-lg">
            <div className="animate-loadingBar bg-gradient-to-r from-primary to-blue-400 h-full w-full"></div>
          </div>

          <p className="text-sm text-gray-400 mt-4  delay-200">
            (Our server is just stretching, almost ready to serve you purr-fect
            content!)
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
