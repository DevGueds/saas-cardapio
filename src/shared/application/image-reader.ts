import type { Result } from "./result"

export interface ImageSource {
  readonly size: number
  readonly type: string
  arrayBuffer(): Promise<ArrayBuffer>
}

export interface ImageReader {
  read(source: ImageSource): Promise<Result<string>>
}
