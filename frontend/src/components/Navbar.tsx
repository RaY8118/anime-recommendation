import { Link } from "react-router-dom";
const Navbar = () => {
  return (
    <nav className="bg-gray-900 text-white px-6 py-4 shadow">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold">
          AnimeRechub
        </Link>
        <div className="space-x-4 flex items-center">
          <Link
            to="/"
            className="hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium"
          >
            Home
          </Link>
          <Link
            to="/browse"
            className="hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium"
          >
            Animes
          </Link>
          <Link
            to="/recommendations"
            className="hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium"
          >
            Recommendations
          </Link>
          <Link
            to="/genres"
            className="hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium"
          >
            Genres
          </Link>
          <Link
            to="/suggest"
            className="hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium"
          >
            Suggest Anime
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
