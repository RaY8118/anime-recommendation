import { useState } from "react";
import { Link } from "react-router-dom";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <nav className="bg-card text-text px-4 py-3 shadow-lg md:px-6">
      <div className="container mx-auto flex items-center justify-between">
        <Link
          to="/"
          className="text-3xl font-extrabold text-primary transition-colors duration-300 hover:text-accent"
        >
          NekoRec
        </Link>

        <div className="md:hidden">
          <button
            onClick={toggleMenu}
            className="rounded-md p-2 text-text-light focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <svg
              className="h-7 w-7"
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

        <div className="hidden md:flex items-center space-x-6">
          <Link
            to="/"
            className="text-text-light transition-colors duration-300 hover:text-primary text-lg font-medium"
          >
            Home
          </Link>
          <Link
            to="/browse"
            className="text-text-light transition-colors duration-300 hover:text-primary text-lg font-medium"
          >
            Animes
          </Link>
          <Link
            to="/recommendations"
            className="text-text-light transition-colors duration-300 hover:text-primary text-lg font-medium"
          >
            Recommendations
          </Link>
          <Link
            to="/genres"
            className="text-text-light transition-colors duration-300 hover:text-primary text-lg font-medium"
          >
            Genres
          </Link>
          <Link
            to="/suggest"
            className="text-text-light transition-colors duration-300 hover:text-primary text-lg font-medium"
          >
            Suggest Anime
          </Link>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden bg-card py-3 shadow-inner">
          <Link
            to="/"
            className="block px-5 py-3 text-base text-text-light transition-colors duration-300 hover:bg-background hover:text-primary"
            onClick={toggleMenu}
          >
            Home
          </Link>
          <Link
            to="/browse"
            className="block px-5 py-3 text-base text-text-light transition-colors duration-300 hover:bg-background hover:text-primary"
            onClick={toggleMenu}
          >
            Animes
          </Link>
          <Link
            to="/recommendations"
            className="block px-5 py-3 text-base text-text-light transition-colors duration-300 hover:bg-background hover:text-primary"
            onClick={toggleMenu}
          >
            Recommendations
          </Link>
          <Link
            to="/genres"
            className="block px-5 py-3 text-base text-text-light transition-colors duration-300 hover:bg-background hover:text-primary"
            onClick={toggleMenu}
          >
            Genres
          </Link>
          <Link
            to="/suggest"
            className="block px-5 py-3 text-base text-text-light transition-colors duration-300 hover:bg-background hover:text-primary"
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
