export class PublicHttpError extends Error {
  constructor(status, code, message, headers = undefined) {
    super(message);
    this.name = "PublicHttpError";
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export function isPublicHttpError(error) {
  return error instanceof PublicHttpError;
}
