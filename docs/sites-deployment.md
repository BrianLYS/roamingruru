# Hosting

The app runs on ChatGPT Sites. `npm run build:sites` builds the React assets and Worker adapter. Runtime secrets are configured server-side, never through VITE_ variables. Public API routes enforce exact origin and signed HttpOnly visitor ownership for stored data. Per-isolate provider limits are suitable for this bounded demo, not a global production quota system.
