import { createContext, useContext } from "react";

export const SFW_STORAGE_KEY = "sfw-mode";

export type SfwContextValue = {
  isSfw: boolean;
  setSfw: (value: boolean) => void;
  toggleSfw: () => void;
};

export const SfwContext = createContext<SfwContextValue | undefined>(undefined);

export const useSfw = (): SfwContextValue => {
  const context = useContext(SfwContext);
  if (!context) {
    throw new Error("useSfw must be used within an SfwProvider");
  }
  return context;
};
