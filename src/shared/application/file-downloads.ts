import type { Result } from "./result"
export interface FileDownloads {
  json(filename: string, data: unknown): Promise<Result<null>>
}
