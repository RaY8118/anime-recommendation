export const Error = ({ message }: { message: string }) => {
  return (
    <div className="flex justify-center items-center h-screen">
      <div className="bg-red-500 text-white p-4 rounded-lg shadow-md text-center">
        <p className="text-lg font-semibold">Error:</p>
        <p>{message}</p>
      </div>
    </div>
  );
};
