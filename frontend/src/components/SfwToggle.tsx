import { ShieldCheckIcon, ShieldExclamationIcon } from "@heroicons/react/24/outline";
import { useSfw } from "../context/SfwContext";

const SfwToggle = () => {
  const { isSfw, toggleSfw } = useSfw();
  const label = isSfw
    ? "SFW mode is on — adult content is hidden"
    : "SFW mode is off — adult content is visible";

  return (
    <button
      onClick={toggleSfw}
      aria-pressed={isSfw}
      aria-label={label}
      title={label}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        isSfw
          ? "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25"
          : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
      }`}
    >
      {isSfw ? (
        <ShieldCheckIcon className="h-5 w-5" />
      ) : (
        <ShieldExclamationIcon className="h-5 w-5" />
      )}
      <span className="hidden sm:inline">SFW</span>
    </button>
  );
};

export default SfwToggle;
