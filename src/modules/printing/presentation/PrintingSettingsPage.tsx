import {
  lazy,
  Suspense,
  useCallback,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react"
import {
  Check,
  ChevronRight,
  CircleHelp,
  FileText,
  Plus,
  Printer,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react"
import { can } from "@cardapio/domain/permissions"
import { receiptKinds } from "@cardapio/domain/printing"
import {
  printingSettingsSchema,
  type PrinterProfile,
  type PrintingSettings,
  type ReceiptDocument,
  type ReceiptKind,
  type ReceiptTemplate,
} from "@cardapio/contracts"
import { useAccount } from "../../identity/presentation/AccountContext"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useResource } from "../../../shared/presentation/use-resource"
import { useMutation } from "../../../shared/presentation/use-mutation"
import { Failure } from "../../../shared/domain/failure"
import PageHeading from "../../../shared/presentation/PageHeading"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import Dialog from "../../../shared/presentation/Dialog"
import FeatureBoundary from "../../../shared/presentation/FeatureBoundary"
import { SelectField } from "../../../shared/presentation/Fields"
import { presetProfile } from "../domain/printer-models"
import PrinterProfileDialog from "./PrinterProfileDialog"
import PrintingHelpDialog from "./PrintingHelpDialog"
import ReceiptPreview from "./ReceiptPreview"
import { receiptLabels, receiptShortLabels } from "./receipt-labels"
import { receiptTestDocument } from "./receipt-test-document"
import "./printing.css"

const ReceiptLayoutEditor = lazy(() => import("./ReceiptLayoutEditor"))
type Tab = "printers" | "receipts"

export default function PrintingSettingsPage() {
  const { printing } = useServices(),
    account = useAccount(),
    { menu } = useMenu()
  const restaurantId = menu.restaurant.id
  const [reset, setReset] = useState(0)
  const [help, setHelp] = useState(false)
  const allowed = can(account?.restaurant.role, "printing:configure")
  const load = useCallback(async () => {
    if (!printing || !allowed)
      throw new Failure("ACCESS_DENIED", "Somente a gestão pode configurar a impressão.")
    return printing.settings(restaurantId)
  }, [printing, allowed, restaurantId])
  const resource = useResource(load)
  return (
    <section className="printing-page">
      <PageHeading
        eyebrow="Sua loja"
        title="Impressão e comprovantes"
        description="Impressoras e modelos de documentos da loja."
      >
        <button type="button" className="secondary-button" onClick={() => setHelp(true)}>
          <CircleHelp size={18} aria-hidden="true" /> Ajuda
        </button>
      </PageHeading>
      {resource.error && (
        <ErrorNotice error={resource.error} onRetry={() => void resource.reload()} />
      )}
      {resource.loading && <p role="status">Carregando configurações de impressão…</p>}
      {allowed && resource.data && (
        <PrintingSettingsForm
          key={`${restaurantId}:${resource.data.revision}:${reset}`}
          restaurantId={restaurantId}
          initial={resource.data}
          disabled={resource.loading || !!resource.error}
          onReload={async () => {
            await resource.reload()
            setReset((value) => value + 1)
          }}
        />
      )}
      {help && <PrintingHelpDialog onClose={() => setHelp(false)} />}
    </section>
  )
}

function PrintingSettingsForm({
  restaurantId,
  initial,
  disabled,
  onReload,
}: {
  restaurantId: string
  initial: PrintingSettings
  disabled: boolean
  onReload(): Promise<void>
}) {
  const { printing, ids } = useServices(),
    mutation = useMutation(),
    id = useId()
  const [draft, setDraft] = useState(initial)
  const [saved, setSaved] = useState(() => JSON.stringify(initial))
  const [tab, setTab] = useState<Tab>("printers")
  const [profileEditor, setProfileEditor] = useState<{
    profile: PrinterProfile
    creating: boolean
  } | null>(null)
  const [kind, setKind] = useState<ReceiptKind>("ORDER")
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorLoaded, setEditorLoaded] = useState(false)
  const [validity, setValidity] = useState<Partial<Record<ReceiptKind, boolean>>>({})
  const [confirm, setConfirm] = useState<"save" | "reload" | null>(null)
  const [removing, setRemoving] = useState<PrinterProfile | null>(null)
  const [replacementId, setReplacementId] = useState("")
  const [test, setTest] = useState<ReceiptDocument | null>(null)
  const busy = disabled || mutation.pending
  const validation = useMemo(() => printingSettingsSchema.safeParse(draft), [draft])
  const serialized = useMemo(() => JSON.stringify(draft), [draft])
  const invalidKinds = receiptKinds.filter((entry) => validity[entry] === false)
  const valid = validation.success && invalidKinds.length === 0
  const dirty = serialized !== saved || invalidKinds.length > 0
  const defaultProfile = draft.profiles.find(
    (profile) => profile.id === draft.defaults[kind],
  )!
  const updateTemplate = useCallback(
    (template: ReceiptTemplate) =>
      setDraft((current) => ({
        ...current,
        templates: { ...current.templates, [kind]: template },
      })),
    [kind],
  )
  const updateLogo = useCallback(
    (logo: string) => setDraft((current) => ({ ...current, logo })),
    [],
  )
  const updateValidity = useCallback(
    (value: boolean) =>
      setValidity((current) =>
        current[kind] === value ? current : { ...current, [kind]: value },
      ),
    [kind],
  )
  function openEditor() {
    setEditorOpen(true)
    setEditorLoaded(true)
  }
  function changeTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
    event.preventDefault()
    const next =
      event.key === "Home"
        ? "printers"
        : event.key === "End"
          ? "receipts"
          : tab === "printers"
            ? "receipts"
            : "printers"
    setTab(next)
    document.getElementById(`${id}-${next}-tab`)?.focus()
  }
  async function save() {
    if (!printing || busy || !valid) return
    const result = await mutation.run(
      () => printing.saveSettings(restaurantId, draft),
      "Configurações de impressão salvas para a loja.",
    )
    if (result?.ok) {
      setDraft(result.value)
      setSaved(JSON.stringify(result.value))
      setConfirm(null)
    }
  }
  function removeProfile() {
    if (
      !removing ||
      draft.profiles.length < 2 ||
      !draft.profiles.some((p) => p.id === replacementId && p.id !== removing.id)
    )
      return
    setDraft((current) => ({
      ...current,
      profiles: current.profiles.filter((p) => p.id !== removing.id),
      defaults: Object.fromEntries(
        receiptKinds.map((entry) => [
          entry,
          current.defaults[entry] === removing.id
            ? replacementId
            : current.defaults[entry],
        ]),
      ) as PrintingSettings["defaults"],
    }))
    setRemoving(null)
  }
  return (
    <>
      <div className="printing-toolbar">
        <div
          className="printing-tabs"
          role="tablist"
          aria-label="Configurações de impressão"
        >
          {(["printers", "receipts"] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              role="tab"
              id={`${id}-${entry}-tab`}
              aria-controls={`${id}-${entry}-panel`}
              aria-selected={tab === entry}
              tabIndex={tab === entry ? 0 : -1}
              onKeyDown={changeTabKey}
              onClick={() => setTab(entry)}
            >
              {entry === "printers" ? (
                <Printer size={18} aria-hidden="true" />
              ) : (
                <FileText size={18} aria-hidden="true" />
              )}
              {entry === "printers" ? "Impressoras" : "Comprovantes"}
            </button>
          ))}
        </div>
        <span className="printing-status">
          <Check size={15} aria-hidden="true" /> Documentos não fiscais
        </span>
        {!dirty && (
          <button
            type="button"
            className="text-button printing-refresh"
            disabled={busy}
            onClick={() => void onReload()}
          >
            <RefreshCw size={16} aria-hidden="true" /> Atualizar
          </button>
        )}
      </div>
      <section
        role="tabpanel"
        id={`${id}-printers-panel`}
        aria-labelledby={`${id}-printers-tab`}
        hidden={tab !== "printers"}
        tabIndex={0}
      >
        <div className="printing-section-heading">
          <div>
            <h2>Suas impressoras</h2>
            <span className="field-help">{draft.profiles.length} de 8 configuradas</span>
          </div>
          <button
            type="button"
            className="primary-button"
            disabled={busy || draft.profiles.length >= 8}
            onClick={() =>
              setProfileEditor({
                profile: presetProfile("generic-58", ids.next()),
                creating: true,
              })
            }
          >
            <Plus size={18} aria-hidden="true" /> Adicionar impressora
          </button>
        </div>
        <ul className="printing-printer-list">
          {draft.profiles.map((profile) => {
            const used = receiptKinds.filter(
              (entry) => draft.defaults[entry] === profile.id,
            )
            return (
              <li className="printing-printer-card" key={profile.id}>
                <span className="printing-printer-icon">
                  <Printer size={24} aria-hidden="true" />
                </span>
                <div className="printing-printer-info">
                  <h3>{profile.name}</h3>
                  <p>
                    {profile.paperWidthMm === 210
                      ? "Papel A4"
                      : `Bobina ${profile.paperWidthMm} mm`}{" "}
                    <span aria-hidden="true">·</span> {profile.copies}{" "}
                    {profile.copies === 1 ? "via" : "vias"}
                  </p>
                  <div className="printing-usage">
                    {used.length ? (
                      used.map((entry) => (
                        <span key={entry}>{receiptShortLabels[entry]}</span>
                      ))
                    ) : (
                      <span>Sem uso padrão</span>
                    )}
                  </div>
                </div>
                <div className="printing-printer-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busy || !valid}
                    onClick={() =>
                      setTest(receiptTestDocument(draft, "ORDER", profile.id))
                    }
                  >
                    Testar impressão
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    aria-label={`Ajustar ${profile.name}`}
                    onClick={() => setProfileEditor({ profile, creating: false })}
                  >
                    <SlidersHorizontal size={16} aria-hidden="true" /> Ajustar
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
      <section
        role="tabpanel"
        id={`${id}-receipts-panel`}
        aria-labelledby={`${id}-receipts-tab`}
        hidden={tab !== "receipts"}
        tabIndex={0}
      >
        <h2 className="printing-panel-title">Modelos de comprovante</h2>
        <div className="printing-document-picker" aria-label="Tipo de comprovante">
          {receiptKinds.map((entry) => (
            <button
              type="button"
              key={entry}
              aria-pressed={kind === entry}
              disabled={busy}
              onClick={() => setKind(entry)}
            >
              <FileText size={20} aria-hidden="true" />
              <span>{receiptShortLabels[entry]}</span>
              {validity[entry] === false && (
                <span className="printing-review-badge">Revisar</span>
              )}
            </button>
          ))}
        </div>
        <div className="settings-card printing-document-settings">
          <div className="printing-section-heading">
            <h3>{receiptLabels[kind]}</h3>
            <button
              type="button"
              className="secondary-button"
              disabled={busy || !valid}
              onClick={() => setTest(receiptTestDocument(draft, kind, defaultProfile.id))}
            >
              <Printer size={17} aria-hidden="true" /> Testar impressão
            </button>
          </div>
          <SelectField
            label="Impressora padrão"
            disabled={busy}
            value={draft.defaults[kind]}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                defaults: { ...current.defaults, [kind]: event.target.value },
              }))
            }
          >
            {draft.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} · {profile.paperWidthMm} mm
              </option>
            ))}
          </SelectField>
          <button
            type="button"
            className="printing-edit-layout"
            aria-expanded={editorOpen}
            aria-controls={`${id}-layout`}
            disabled={busy}
            onClick={() => (editorOpen ? setEditorOpen(false) : openEditor())}
          >
            <span>
              <strong>Layout e logo</strong>
              <small>
                {draft.templates[kind].blocks.length} blocos ·{" "}
                {draft.logo ? "Com logo" : "Sem logo"}
              </small>
            </span>
            <span>
              {editorOpen ? "Recolher" : "Personalizar"}
              <ChevronRight size={18} aria-hidden="true" />
            </span>
          </button>
          <div id={`${id}-layout`} hidden={!editorOpen}>
            {editorLoaded && (
              <FeatureBoundary label="Editor de comprovantes">
                <Suspense fallback={<p role="status">Abrindo editor…</p>}>
                  <ReceiptLayoutEditor
                    kind={kind}
                    template={draft.templates[kind]}
                    logo={draft.logo}
                    onChange={updateTemplate}
                    onLogoChange={updateLogo}
                    onValidityChange={updateValidity}
                    disabled={busy}
                  />
                </Suspense>
              </FeatureBoundary>
            )}
          </div>
        </div>
      </section>
      {mutation.error && <ErrorNotice error={mutation.error} />}
      {!validation.success && (
        <p className="field-error" role="alert">
          Revise as configurações antes de salvar: {validation.error.issues[0]?.message}
        </p>
      )}
      {invalidKinds.length > 0 && (tab !== "receipts" || !editorOpen) && (
        <div className="printing-invalid" role="status">
          <span>
            Há ajustes pendentes em{" "}
            {invalidKinds.map((entry) => receiptShortLabels[entry]).join(", ")}.
          </span>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setTab("receipts")
              setKind(invalidKinds[0]!)
              openEditor()
            }}
          >
            Revisar comprovante
          </button>
        </div>
      )}
      {dirty && (
        <div className="printing-save-bar">
          <span role="status">Alterações não salvas</span>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => setConfirm("reload")}
          >
            Descartar
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={busy || !valid}
            onClick={() => {
              mutation.clearError()
              setConfirm("save")
            }}
          >
            {mutation.pending ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      )}
      {profileEditor && (
        <PrinterProfileDialog
          key={profileEditor.profile.id}
          initial={profileEditor.profile}
          creating={profileEditor.creating}
          canRemove={draft.profiles.length > 1}
          onClose={() => setProfileEditor(null)}
          onApply={(profile) => {
            setDraft((current) => ({
              ...current,
              profiles: profileEditor.creating
                ? [...current.profiles, profile]
                : current.profiles.map((entry) =>
                    entry.id === profile.id ? profile : entry,
                  ),
            }))
            setProfileEditor(null)
          }}
          onRemove={() => {
            setReplacementId(
              draft.profiles.find((p) => p.id !== profileEditor.profile.id)!.id,
            )
            setRemoving(profileEditor.profile)
            setProfileEditor(null)
          }}
        />
      )}
      {removing && (
        <Dialog title="Remover impressora?" onClose={() => setRemoving(null)}>
          <p>Remover “{removing.name}” das configurações da loja.</p>
          {receiptKinds.some((entry) => draft.defaults[entry] === removing.id) && (
            <SelectField
              label="Usar no lugar"
              value={replacementId}
              onChange={(event) => setReplacementId(event.target.value)}
            >
              {draft.profiles
                .filter((p) => p.id !== removing.id)
                .map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
            </SelectField>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setRemoving(null)}
            >
              Cancelar
            </button>
            <button type="button" className="primary-button" onClick={removeProfile}>
              Remover
            </button>
          </div>
        </Dialog>
      )}
      {confirm && (
        <Dialog
          title={
            confirm === "save" ? "Salvar configuração da loja?" : "Descartar alterações?"
          }
          busy={mutation.pending}
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm === "save"
              ? "Os próximos documentos de toda a equipe usarão estes padrões. Arquivos já baixados permanecem iguais."
              : "Os ajustes não salvos serão descartados. As configurações da loja serão recarregadas."}
          </p>
          {mutation.error && <ErrorNotice error={mutation.error} />}
          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={mutation.pending}
              onClick={() => setConfirm(null)}
            >
              Voltar
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={busy || (confirm === "save" && !valid)}
              onClick={() => {
                if (confirm === "save") void save()
                else {
                  setConfirm(null)
                  void onReload()
                }
              }}
            >
              {mutation.pending
                ? "Salvando…"
                : confirm === "save"
                  ? "Confirmar"
                  : "Descartar alterações"}
            </button>
          </div>
        </Dialog>
      )}
      {test && (
        <Dialog
          title="Teste de impressão — dados fictícios"
          className="receipt-dialog"
          onClose={() => setTest(null)}
        >
          <div className="printing-test-heading">
            <span className="printing-status">Dados fictícios</span>
            <span>{test.profile.name}</span>
          </div>
          <ReceiptPreview document={test} />
        </Dialog>
      )}
    </>
  )
}
