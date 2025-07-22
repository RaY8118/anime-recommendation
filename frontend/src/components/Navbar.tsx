import { useState } from "react";
import { Link } from "react-router-dom";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <nav className="bg-gray-900 text-white px-6 py-4 shadow">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold">
          NekoRec
        </Link>

        {/* Hamburger menu button for mobile */}
        <div className="md:hidden">
          <button
            onClick={toggleMenu}
            className="text-white focus:outline-none"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              {isOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                ></path>
              )}
            </svg>
          </button>
        </div>

        {/* Desktop menu */}
        <div className="hidden md:flex space-x-4 items-center">
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

      {/* Mobile menu, toggles based on isOpen state */}
      {isOpen && (
        <div className="md:hidden bg-gray-800 py-2">
          <Link
            to="/"
            className="block px-4 py-2 text-sm text-white hover:bg-gray-700"
            onClick={toggleMenu}
          >
            Home
          </Link>
          <Link
            to="/browse"
            className="block px-4 py-2 text-sm text-white hover:bg-gray-700"
            onClick={toggleMenu}
          >
            Animes
          </Link>
          <Link
            to="/recommendations"
            className="block px-4 py-2 text-sm text-white hover:bg-gray-700"
            onClick={toggleMenu}
          >
            Recommendations
          </Link>
          <Link
            to="/genres"
            className="block px-4 py-2 text-sm text-white hover:bg-gray-700"
            onClick={toggleMenu}
          >
            Genres
          </Link>
          <Link
            to="/suggest"
            className="block px-4 py-2 text-sm text-white hover:bg-gray-700"
            onClick={toggleMenu}
          >
            Suggest Anime
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
