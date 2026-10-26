import type { ReceiptDocument } from "@cardapio/contracts"
import type { Result } from "../../../shared/application/result"

export interface ReceiptOutput {
  pdf: Blob
  html: string
  filename: string
  pageCount: number
  warnings: string[]
}

export interface ReceiptBinaryOutput {
  blob: Blob
  bytes: Uint8Array
  filename: string
}

/** Creates files only. No implementation may submit a job to a physical printer. */
export interface ReceiptOutputRenderer {
  create(input: ReceiptDocument): Promise<Result<ReceiptOutput>>
  escpos(input: ReceiptDocument): Promise<Result<ReceiptBinaryOutput>>
}
