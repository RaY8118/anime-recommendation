import logo from "../assets/favicon.png";
export const Loader = () => {
  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="h-30 w-30 animate-spin rounded-full border-4 border-solid border-primary border-t-transparent glow-primary">
        <img src={logo} alt="NkoRec Logo" className="h-full w-full" />
      </div>
    </div>
  );
};
