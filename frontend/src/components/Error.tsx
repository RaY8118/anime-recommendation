export const Error = ({ message }: { message: string }) => {
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="max-w-md rounded-2xl glass border-red-400/40 p-8 text-center shadow-xl shadow-red-500/10">
        <h2 className="mb-4 text-4xl font-bold text-red-400">Oops!</h2>
        <p className="text-xl text-text">{message}</p>
        <p className="mt-6 text-lg text-text-light">Please try again later.</p>
      </div>
    </div>
  );
};
