export interface ErrorReport {
  readonly event: string;
  readonly message: string;
  readonly name: string | null;
  readonly stack: string | null;
}

export const errorLogPayload = (event: string, cause: unknown): ErrorReport => {
  if (cause instanceof Error) {
    return {
      event,
      message: cause.message,
      name: cause.name,
      stack: cause.stack ?? null,
    };
  }
  return {
    event,
    message: String(cause),
    name: null,
    stack: null,
  };
};

export const reportError = (event: string, cause: unknown): void => {
  console.error(errorLogPayload(event, cause));
};
