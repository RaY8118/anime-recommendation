# Frontend Overview

This is the frontend for the NekoRec anime recommendation system. It is a React application written in TypeScript and built with Vite.

## Key Technologies

- **React:** A JavaScript library for building user interfaces.
- **TypeScript:** A typed superset of JavaScript that compiles to plain JavaScript.
- **Vite:** A fast build tool and development server.
- **Tanstack Query:** Used for data fetching, caching, and state management.
- **Tailwind CSS:** A utility-first CSS framework for styling the application.
- **React Router:** Used for routing and navigation within the application.
- **Auth0 React:** Used for authentication.

## Project Structure

- `src/`: The main application directory.
  - `components/`: Contains reusable React components.
  - `pages/`: Represents the different pages of the application.
  - `services/`: Contains the `api.ts` file, which is responsible for making API requests to the backend.
  - `hooks/`: Contains custom React hooks.
  - `types/`: Contains TypeScript type definitions.
  - `App.tsx`: The main application component.
  - `main.tsx`: The entry point of the React application.
- `package.json`: The project's dependency and script configuration file.
- `vite.config.ts`: The configuration file for Vite.

## Running the Application

To run the frontend development server, use the following command:

```bash
npm run dev
```

This will start the server on `http://localhost:5173`, and it will automatically reload when code changes are detected.
