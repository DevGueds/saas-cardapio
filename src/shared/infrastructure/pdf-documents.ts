import type { DocumentExporter, TableDocument } from "../application/documents"
import type { Executor } from "../application/execute"
export class PdfDocuments implements DocumentExporter {
  constructor(private readonly executor: Executor) {}
  pdf(input: TableDocument) {
    return this.executor.run("documents", "pdf", async () => {
      const [{ jsPDF }, { autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ])
      const doc = new jsPDF({ orientation: "landscape", compress: true })
      doc.setProperties({ title: input.title, creator: "Cardápio" })
      doc.setFontSize(18)
      const title = doc.splitTextToSize(input.title, 265) as string[]
      doc.text(title, 14, 18)
      doc.setFontSize(10)
      const subtitle = doc.splitTextToSize(input.subtitle, 265) as string[]
      doc.text(subtitle, 14, 22 + title.length * 7)
      let nextY = 30 + title.length * 7 + subtitle.length * 4
      for (const section of input.sections) {
        if (nextY > 165) {
          doc.addPage()
          nextY = 18
        }
        doc.setFontSize(12)
        doc.text(section.title, 14, nextY)
        autoTable(doc, {
          startY: nextY + 4,
          head: [section.columns],
          body: section.rows,
          styles: {
            font: "helvetica",
            fontSize: 8,
            cellPadding: 2.5,
            overflow: "linebreak",
          },
          headStyles: { fillColor: [15, 95, 76] },
          margin: { bottom: 16, top: 14 },
        })
        nextY =
          (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY +
          12
      }
      const pages = doc.getNumberOfPages()
      for (let page = 1; page <= pages; page++) {
        doc.setPage(page)
        doc.setFontSize(8)
        doc.text(
          `Cardápio | Documento gerencial, sem valor fiscal | ${page}/${pages}`,
          14,
          202,
        )
      }
      await doc.save(input.filename, { returnPromise: true })
    })
  }
}
