import type { Result } from "./result"
export interface TableDocument {
  title: string
  subtitle: string
  filename: string
  sections: { title: string; columns: string[]; rows: (string | number)[][] }[]
}
export interface DocumentExporter {
  pdf(document: TableDocument): Promise<Result<void>>
}
