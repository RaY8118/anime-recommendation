import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Browse from "./pages/Browse";
import AnimeDetails from "./pages/AnimeDetails";
import Recommendations from "./pages/Recommendations";
import Genres from "./pages/Genres";
import SuggestAnime from "./pages/SuggestAnime";

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow">
          {" "}
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
