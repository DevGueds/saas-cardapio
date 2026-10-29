import type { FileDownloads } from "../application/file-downloads"
import type { Executor } from "../application/execute"
export class BrowserFileDownloads implements FileDownloads {
  constructor(private readonly executor: Executor) {}
  json(filename: string, data: unknown) {
    return this.executor.run("files", "download-json", async () => {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json;charset=utf-8",
      })
      const url = URL.createObjectURL(blob)
      try {
        const link = document.createElement("a")
        link.href = url
        link.download = filename
        document.body.append(link)
        link.click()
        link.remove()
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
      return null
    })
  }
}
