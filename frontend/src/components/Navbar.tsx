import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useMediaQuery } from "../hooks/useMediaQuery";
import SfwToggle from "./SfwToggle";
import ThemeToggle from "./ThemeToggle";
import { useAuth0, type User } from "@auth0/auth0-react";
import { Button, Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import {
  ArrowRightOnRectangleIcon,
  BookmarkIcon,
  ChevronDownIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

const UserAvatar = ({
  user,
  size = "h-8 w-8",
}: {
  user: User | undefined;
  size?: string;
}) =>
  user?.picture ? (
    <img
      src={user.picture}
      alt={user.nickname ?? "User"}
      referrerPolicy="no-referrer"
      className={`${size} rounded-full object-cover`}
    />
  ) : (
    <span
      className={`${size} flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-bold text-white`}
    >
      {(user?.nickname ?? user?.name ?? "U").charAt(0).toUpperCase()}
    </span>
  );

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
          className="mx-auto glass shadow-lg shadow-primary/10 border-b md:border"
        >
          <div className="flex items-center justify-between w-full mx-auto px-6 md:px-8 py-4">
            <Link
              to="/"
              onClick={closeMenu}
              className="flex items-center space-x-3"
            >
              <span className="text-3xl font-extrabold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(168,85,247,0.35)] transition-opacity duration-300 hover:opacity-85">
                NekoRec
              </span>
            </Link>

            {isDesktop && (
              <div className="flex items-center space-x-6">
                <Link
                  to="/"
                  className="rounded-full px-3 py-1 text-lg font-medium text-text-light transition-all duration-300 hover:bg-primary/10 hover:text-primary"
                >
                  Home
                </Link>
                <Link
                  to="/browse"
                  className="rounded-full px-3 py-1 text-lg font-medium text-text-light transition-all duration-300 hover:bg-primary/10 hover:text-primary"
                >
                  Animes
                </Link>
                <Link
                  to="/recommendations"
                  className="rounded-full px-3 py-1 text-lg font-medium text-text-light transition-all duration-300 hover:bg-primary/10 hover:text-primary"
                >
                  Recommendations
                </Link>
                <Link
                  to="/watchlist"
                  className="rounded-full px-3 py-1 text-lg font-medium text-text-light transition-all duration-300 hover:bg-primary/10 hover:text-primary"
                >
                  Watchlist
                </Link>
                <Link
                  to="/suggest"
                  className="rounded-full px-3 py-1 text-lg font-medium text-text-light transition-all duration-300 hover:bg-primary/10 hover:text-primary"
                >
                  Suggest Anime
                </Link>
                {!isAuthenticated ? (
                  <button
                    onClick={() => loginWithRedirect()}
                    className="rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2 font-semibold text-white shadow-md shadow-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-accent/40 hover:brightness-110"
                  >
                    Login
                  </button>
                ) : (
                  <Menu as="div" className="relative">
                    <MenuButton className="flex items-center gap-1.5 rounded-full border border-border bg-surface p-1 pr-2 text-text transition-colors hover:border-primary focus:outline-none">
                      <UserAvatar user={user} />
                      <ChevronDownIcon className="h-4 w-4 text-text-light" />
                    </MenuButton>
                    <MenuItems
                      transition
                      anchor="bottom end"
                      className="z-[60] w-56 rounded-2xl glass p-2 shadow-2xl shadow-primary/20 focus:outline-none transition duration-150 ease-out data-[closed]:translate-y-1 data-[closed]:opacity-0"
                    >
                        <div className="mb-1 border-b border-border px-3 py-2">
                          <p className="truncate text-sm font-semibold text-text">
                            {user?.name ?? user?.nickname}
                          </p>
                          {user?.email && (
                            <p className="truncate text-xs text-text-light">
                              {user.email}
                            </p>
                          )}
                        </div>
                        <MenuItem>
                          {({ focus }) => (
                            <Link
                              to="/watchlist"
                              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                                focus
                                  ? "bg-primary/10 text-primary"
                                  : "text-text-light"
                              }`}
                            >
                              <BookmarkIcon className="h-4 w-4" />
                              My Watchlist
                            </Link>
                          )}
                        </MenuItem>
                        <MenuItem>
                          {({ focus }) => (
                            <Link
                              to="/recommendations"
                              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                                focus
                                  ? "bg-primary/10 text-primary"
                                  : "text-text-light"
                              }`}
                            >
                              <SparklesIcon className="h-4 w-4" />
                              Recommendations
                            </Link>
                          )}
                        </MenuItem>
                        <MenuItem>
                          {({ focus }) => (
                            <button
                              onClick={() =>
                                logout({
                                  logoutParams: {
                                    returnTo: window.location.origin,
                                  },
                                })
                              }
                              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                focus
                                  ? "bg-red-500/10 text-red-500"
                                  : "text-text-light"
                              }`}
                            >
                              <ArrowRightOnRectangleIcon className="h-4 w-4" />
                              Log out
                            </button>
                          )}
                        </MenuItem>
                    </MenuItems>
                  </Menu>
                )}
                <SfwToggle />
                <ThemeToggle />
              </div>
            )}

            {!isDesktop && (
              <div className="flex items-center gap-1">
                <SfwToggle />
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
              className="p-5 glass rounded-2xl mx-auto shadow-2xl shadow-primary/20"
              style={{
                borderRadius: isScrolled ? "2rem" : "1.5rem",
              }}
            >
              <div className="flex flex-col space-y-5 items-center">
                <Link
                  to="/"
                  className="block rounded-lg px-3 py-2 text-base text-text-light transition-colors duration-300 hover:bg-primary/10 hover:text-primary"
                  onClick={toggleMenu}
                >
                  Home
                </Link>
                <Link
                  to="/browse"
                  className="block rounded-lg px-3 py-2 text-base text-text-light transition-colors duration-300 hover:bg-primary/10 hover:text-primary"
                  onClick={toggleMenu}
                >
                  Animes
                </Link>
                <Link
                  to="/recommendations"
                  className="block rounded-lg px-3 py-2 text-base text-text-light transition-colors duration-300 hover:bg-primary/10 hover:text-primary"
                  onClick={toggleMenu}
                >
                  Recommendations
                </Link>
                <Link
                  to="/genres"
                  className="block rounded-lg px-3 py-2 text-base text-text-light transition-colors duration-300 hover:bg-primary/10 hover:text-primary"
                  onClick={toggleMenu}
                >
                  Genres
                </Link>
                <Link
                  to="/suggest"
                  className="block rounded-lg px-3 py-2 text-base text-text-light transition-colors duration-300 hover:bg-primary/10 hover:text-primary"
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
                    className="w-full rounded-full bg-gradient-to-r from-primary to-accent py-2 px-4 font-semibold text-white shadow-md shadow-primary/30 transition-all duration-300 hover:brightness-110"
                  >
                    Login
                  </button>
                ) : (
                  <>
                    <div className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2">
                      <UserAvatar user={user} size="h-10 w-10" />
                      <div className="min-w-0 text-left">
                        <p className="truncate text-sm font-semibold text-text">
                          {user?.name ?? user?.nickname}
                        </p>
                        {user?.email && (
                          <p className="truncate text-xs text-text-light">
                            {user.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        logout({
                          logoutParams: { returnTo: window.location.origin },
                        });
                        toggleMenu();
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-red-500/90 px-4 py-1.5 text-sm font-semibold text-white shadow-inner shadow-white/10 transition-colors data-hover:bg-red-500 focus:outline-none"
                    >
                      <ArrowRightOnRectangleIcon className="h-4 w-4" />
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
