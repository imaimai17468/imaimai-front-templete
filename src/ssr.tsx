import startEntry from "@tanstack/react-start/server-entry";

export default {
  fetch(request: Request) {
    return startEntry.fetch(request);
  },
} satisfies ExportedHandler<CloudflareEnv>;
