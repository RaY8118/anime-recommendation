import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  SFW_STORAGE_KEY,
  SfwContext,
  type SfwContextValue,
} from "./SfwContext";

export const SfwProvider = ({ children }: { children: ReactNode }) => {
  const [isSfw, setIsSfw] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem(SFW_STORAGE_KEY);
    return saved === null ? true : saved === "true";
  });

  useEffect(() => {
    localStorage.setItem(SFW_STORAGE_KEY, String(isSfw));
    document.documentElement.classList.toggle("sfw", isSfw);
  }, [isSfw]);

  const toggleSfw = useCallback(() => setIsSfw((prev) => !prev), []);

  const value = useMemo<SfwContextValue>(
    () => ({ isSfw, setSfw: setIsSfw, toggleSfw }),
    [isSfw, toggleSfw]
  );

  return <SfwContext.Provider value={value}>{children}</SfwContext.Provider>;
};
