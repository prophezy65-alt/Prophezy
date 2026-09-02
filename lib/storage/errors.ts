export class StorageError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "StorageError";
    this.code = code;
  }
}
