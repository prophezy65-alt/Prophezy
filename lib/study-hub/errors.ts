export class StudyHubError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = "StudyHubError";
    this.code = code;
    this.status = status;
  }
}
