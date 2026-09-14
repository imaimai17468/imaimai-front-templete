export interface ErrorReport {
  readonly event: string;
  readonly message: string;
  readonly name: string | null;
  readonly stack: string | null;
}

export const errorLogPayload = (event: string, error: unknown): ErrorReport => {
  if (error instanceof Error) {
    return {
      event,
      message: error.message,
      name: error.name,
      stack: error.stack ?? null,
    };
  }
  return {
    event,
    message: String(error),
    name: null,
    stack: null,
  };
};

export const reportError = (event: string, error: unknown): void => {
  console.error(errorLogPayload(event, error));
};
