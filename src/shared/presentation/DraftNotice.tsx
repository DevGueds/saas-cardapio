export default function DraftNotice({
  draft,
}: {
  draft: { saved: boolean; issue: string | null; clear(): void }
}) {
  if (!draft.saved && !draft.issue) return null
  return (
    <div
      className={draft.issue ? "info-notice draft-notice" : "draft-notice"}
      role="status"
    >
      <span>{draft.issue ?? "Rascunho salvo neste navegador por 24 horas."}</span>
      <button type="button" className="text-button" onClick={draft.clear}>
        Descartar rascunho
      </button>
    </div>
  )
}
