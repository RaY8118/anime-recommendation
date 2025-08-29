import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useMediaQuery } from "../hooks/useMediaQuery";
import ThemeToggle from "./ThemeToggle";
import { useAuth0 } from "@auth0/auth0-react";
import { Button } from '@headlessui/react';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { isAuthenticated, loginWithRedirect, logout, user } = useAuth0();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const navContainerVariants = {
    top: {
      width: "100%",
      borderRadius: "0px",
      marginTop: "0rem",
      borderBottom: "1px solid rgba(168, 85, 247, 0.4)",
    },
    scrolled: {
      width: isDesktop ? "72rem" : "95%",
      borderRadius: isDesktop ? "9999px" : "2rem",
      marginTop: "1rem",
      borderBottom: "2px solid rgba(168, 85, 247, 0.6)",
    },
  };

  const mobileMenuVariants = {
    hidden: {
      opacity: 0,
      y: -20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        opacity: { duration: 0.3 },
        y: { duration: 0.3 },
      },
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: {
        opacity: { duration: 0.2 },
        y: { duration: 0.2 },
      },
    },
  };

  const dropdownContainerVariants = {
    hidden: {
      backdropFilter: "blur(0px)",
    },
    visible: {
      backdropFilter: "blur(16px)",
      transition: {
        backdropFilter: { duration: 0.4, delay: 0.2 },
      },
    },
    exit: {
      backdropFilter: "blur(0px)",
      transition: {
        backdropFilter: { duration: 0.1 },
      },
    },
  };

  return (
    <>
      <nav className="sticky top-0 z-50 w-full overflow-x-hidden">
        <motion.div
          variants={navContainerVariants}
          animate={isScrolled ? "scrolled" : "top"}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="mx-auto bg-black/30 backdrop-blur-lg border-b md:border border-white/10"
        >
          <div className="flex items-center justify-between w-full mx-auto px-6 md:px-8 py-4">
            <Link
              to="/"
              onClick={closeMenu}
              className="flex items-center space-x-3"
            >
              <span className="text-3xl font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent transition-opacity duration-300 hover:opacity-80">
                NekoRec
              </span>
            </Link>

            {isDesktop && (
              <div className="flex items-center space-x-6">
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
                  to="/watchlist"
                  className="text-text-light transition-colors duration-300 hover:text-primary text-lg font-medium"
                >
                  Watchlist
                </Link>
                <Link
                  to="/suggest"
                  className="text-text-light transition-colors duration-300 hover:text-primary text-lg font-medium"
                >
                  Suggest Anime
                </Link>
                {!isAuthenticated ? (
                  <button
                    onClick={() => loginWithRedirect()}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Login
                  </button>
                ) : (
                  <>
                    <span className="mr-4">Hello, {user?.nickname}</span>
                    <Button
                      onClick={() =>
                        logout({
                          logoutParams: { returnTo: window.location.origin },
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-md bg-red-500 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-inner shadow-white/10 focus:not-data-focus:outline-none data-focus:outline data-focus:outline-white data-hover:bg-red-700 data-open:bg-red-500"
                    >
                      Logout
                    </Button>
                  </>
                )}
                <ThemeToggle />
              </div>
            )}

            {!isDesktop && (
              <div className="flex items-center">
                <ThemeToggle />
                <button
                  onClick={toggleMenu}
                  className="rounded-md p-2 text-text-light focus:outline-none ml-2"
                  aria-label="Toggle Menu"
                >
                  <svg
                    className="h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
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
                        d="M4 6h16M4 12h16m-7 6h7"
                      ></path>
                    )}
                  </svg>
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </nav>

      {/* mobiledropdown */}
      <AnimatePresence>
        {isOpen && !isDesktop && (
          <motion.div
            variants={mobileMenuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed left-1/2 transform -translate-x-1/2 z-40 px-4"
            style={{
              top: isScrolled ? "6rem" : "5rem",
              width: isScrolled ? "95%" : "100%",
              maxWidth: isScrolled ? "72rem" : "100%",
            }}
          >
            <motion.div
              variants={dropdownContainerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="p-5 bg-black/40 border border-white/10 rounded-2xl mx-auto"
              style={{
                borderRadius: isScrolled ? "2rem" : "1.5rem",
              }}
            >
              <div className="flex flex-col space-y-5 items-center">
                <Link
                  to="/"
                  className="block py-2 text-base text-text-light transition-colors duration-300 hover:text-primary"
                  onClick={toggleMenu}
                >
                  Home
                </Link>
                <Link
                  to="/browse"
                  className="block py-2 text-base text-text-light transition-colors duration-300 hover:text-primary"
                  onClick={toggleMenu}
                >
                  Animes
                </Link>
                <Link
                  to="/recommendations"
                  className="block py-2 text-base text-text-light transition-colors duration-300 hover:text-primary"
                  onClick={toggleMenu}
                >
                  Recommendations
                </Link>
                <Link
                  to="/genres"
                  className="block py-2 text-base text-text-light transition-colors duration-300 hover:text-primary"
                  onClick={toggleMenu}
                >
                  Genres
                </Link>
                <Link
                  to="/suggest"
                  className="block py-2 text-base text-text-light transition-colors duration-300 hover:text-primary"
                  onClick={toggleMenu}
                >
                  Suggest Anime
                </Link>
                {!isAuthenticated ? (
                  <button
                    onClick={() => {
                      loginWithRedirect();
                      toggleMenu();
                    }}
                    className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Login
                  </button>
                ) : (
                  <>
                    <span className="text-text-light">
                      Hello, {user?.nickname}
                    </span>
                    <Button
                      onClick={() => {
                        logout({
                          logoutParams: { returnTo: window.location.origin },
                        });
                        toggleMenu();
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-red-500 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-inner shadow-white/10 focus:not-data-focus:outline-none data-focus:outline data-focus:outline-white data-hover:bg-red-700 data-open:bg-red-500"
                    >
                      Logout
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
