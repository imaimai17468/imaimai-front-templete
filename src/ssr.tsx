import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";

const handler = createStartHandler(defaultStreamHandler);

export default {
  async fetch(request: Request) {
    return await handler(request);
  },
} satisfies ExportedHandler<CloudflareEnv>;
