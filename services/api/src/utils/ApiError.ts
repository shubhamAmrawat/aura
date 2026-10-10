/** Throw from anywhere in a request; errorHandler turns it into `{ error: message }`. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}
