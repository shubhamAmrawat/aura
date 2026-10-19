/** Throw from anywhere in a request; errorHandler turns it into `{ error: message, ...extra }`. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Extra fields for the JSON body (e.g. the wallpaper an upload duplicates) */
    public readonly extra?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}
