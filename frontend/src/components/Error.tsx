export const Error = ({ message }: { message: string }) => {
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="rounded-lg bg-red-800 p-8 text-center shadow-xl">
        <h2 className="mb-4 text-4xl font-bold text-white">Oops!</h2>
        <p className="text-xl text-white">{message}</p>
        <p className="mt-6 text-lg text-red-200">Please try again later.</p>
      </div>
    </div>
  );
};
