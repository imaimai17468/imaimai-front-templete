import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";

const handler = createStartHandler(defaultStreamHandler);

export default {
  fetch(request: Request) {
    return handler(request);
  },
} satisfies ExportedHandler<CloudflareEnv>;
