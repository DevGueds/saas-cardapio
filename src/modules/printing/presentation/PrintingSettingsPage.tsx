import { lazy, Suspense, useCallback, useMemo, useState } from "react"
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
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import { SelectField } from "../../../shared/presentation/Fields"
import { presetProfile, printerModels } from "../domain/printer-models"
import PrinterProfileForm from "./PrinterProfileForm"
import ReceiptPreview from "./ReceiptPreview"
import { receiptLabels } from "./receipt-labels"
import { receiptTestDocument } from "./receipt-test-document"
import "./printing.css"

const ReceiptLayoutEditor = lazy(() => import("./ReceiptLayoutEditor"))

export default function PrintingSettingsPage() {
  const { printing } = useServices(),
    account = useAccount(),
    { menu } = useMenu()
  const restaurantId = menu.restaurant.id
  const [reset, setReset] = useState(0)
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
        eyebrow="Documentos da operação"
        title="Impressão e comprovantes"
        description="Configure papel, modelos e conteúdo. Emita documentos a partir dos pedidos ou do histórico de recebimentos."
      />
      <div className="info-notice">
        <strong>Todos os comprovantes são não fiscais.</strong> A impressão não registra
        pagamento nem confirma entrega. A indicação não fiscal e a situação registrada
        permanecem no documento, mesmo após editar o layout.
      </div>
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
    mutation = useMutation()
  const [draft, setDraft] = useState(initial)
  const [saved, setSaved] = useState(() => JSON.stringify(initial))
  const [profileId, setProfileId] = useState(initial.profiles[0]!.id)
  const [modelId, setModelId] = useState("generic-58")
  const [kind, setKind] = useState<ReceiptKind>("ORDER")
  const [editorOpen, setEditorOpen] = useState(false)
  const [validity, setValidity] = useState<Partial<Record<ReceiptKind, boolean>>>({})
  const [confirm, setConfirm] = useState<"save" | "reload" | "remove" | null>(null)
  const [test, setTest] = useState<ReceiptDocument | null>(null)
  const busy = disabled || mutation.pending
  const selected =
    draft.profiles.find((profile) => profile.id === profileId) ?? draft.profiles[0]!
  const validation = useMemo(() => printingSettingsSchema.safeParse(draft), [draft])
  const invalidKinds = receiptKinds.filter((entry) => validity[entry] === false)
  const valid = validation.success && invalidKinds.length === 0
  const dirty = JSON.stringify(draft) !== saved || invalidKinds.length > 0
  const used = receiptKinds.filter((entry) => draft.defaults[entry] === selected.id)
  const updateProfile = useCallback(
    (profile: PrinterProfile) =>
      setDraft((current) => ({
        ...current,
        profiles: current.profiles.map((entry) =>
          entry.id === profile.id ? profile : entry,
        ),
      })),
    [],
  )
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
  return (
    <>
      <ValidatedForm
        className="printing-settings"
        onSubmit={(event) => {
          event.preventDefault()
          if (!busy && valid && dirty) {
            mutation.clearError()
            setConfirm("save")
          }
        }}
      >
        <fieldset disabled={busy} className="printing-fieldset">
          <div className="settings-card">
            <h2>1. Escolha a impressora e o papel</h2>
            <p>
              Use um perfil pronto como ponto de partida. Você pode salvar até oito perfis
              e ajustar cada um após uma impressão de teste.
            </p>
            <div className="printing-profile-picker">
              <SelectField
                label="Modelo para adicionar"
                value={modelId}
                onChange={(event) => setModelId(event.target.value)}
              >
                {printerModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </SelectField>
              <button
                type="button"
                className="secondary-button"
                disabled={draft.profiles.length >= 8}
                onClick={() => {
                  const profile = presetProfile(modelId, ids.next())
                  setDraft((current) => ({
                    ...current,
                    profiles: [...current.profiles, profile],
                  }))
                  setProfileId(profile.id)
                }}
              >
                Adicionar perfil
              </button>
            </div>
            <SelectField
              label="Perfil em edição"
              value={selected.id}
              onChange={(event) => setProfileId(event.target.value)}
            >
              {draft.profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} · {profile.paperWidthMm} mm
                </option>
              ))}
            </SelectField>
            <PrinterProfileForm profile={selected} onChange={updateProfile} />
            <button
              type="button"
              className="text-button"
              disabled={draft.profiles.length === 1 || used.length > 0}
              onClick={() => setConfirm("remove")}
            >
              Remover este perfil
            </button>
            {used.length > 0 && (
              <p className="field-help">
                Para remover, escolha outro perfil padrão em:{" "}
                {used.map((entry) => receiptLabels[entry]).join(", ")}.
              </p>
            )}
          </div>
          <div className="settings-card">
            <h2>2. Defina o perfil de cada documento</h2>
            <div className="printing-field-grid">
              {receiptKinds.map((entry) => (
                <SelectField
                  key={entry}
                  label={receiptLabels[entry]}
                  value={draft.defaults[entry]}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      defaults: { ...current.defaults, [entry]: event.target.value },
                    }))
                  }
                >
                  {draft.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </SelectField>
              ))}
            </div>
            <p className="field-help">
              A equipe poderá escolher outro perfil ao emitir. Na cozinha, o documento
              contém apenas as informações necessárias para o preparo.
            </p>
          </div>
          <div className="settings-card">
            <h2>3. Personalize o comprovante</h2>
            <SelectField
              label="Documento para editar e testar"
              value={kind}
              onChange={(event) => setKind(event.target.value as ReceiptKind)}
            >
              {receiptKinds.map((entry) => (
                <option key={entry} value={entry}>
                  {receiptLabels[entry]}
                  {validity[entry] === false ? " — revisar editor" : ""}
                </option>
              ))}
            </SelectField>
            {!editorOpen ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setValidity((current) => ({ ...current, [kind]: false }))
                  setEditorOpen(true)
                }}
              >
                Editar layout e logo
              </button>
            ) : (
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
            <p className="field-help">
              Logo e textos são salvos apenas após confirmar as alterações. Dados dos
              pedidos entram automaticamente; não digite nomes de clientes ou valores
              fixos no layout.
            </p>
            {invalidKinds.length > 0 && (
              <p className="field-help" role="status">
                Aguarde ou revise o editor de:{" "}
                {invalidKinds.map((entry) => receiptLabels[entry]).join(", ")}.
              </p>
            )}
            <button
              type="button"
              className="secondary-button"
              disabled={!valid}
              onClick={() => setTest(receiptTestDocument(draft, kind, selected.id))}
            >
              Testar layout no perfil em edição
            </button>
          </div>
        </fieldset>
        {mutation.error && <ErrorNotice error={mutation.error} />}
        {!validation.success && (
          <p className="field-error" role="alert">
            Revise as configurações antes de salvar: {validation.error.issues[0]?.message}
          </p>
        )}
        <div className="printing-save-bar">
          <span role="status">
            {dirty ? "Alterações ainda não salvas" : "Configurações salvas"}
          </span>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => setConfirm("reload")}
          >
            Recarregar configurações
          </button>
          <button className="primary-button" disabled={busy || !valid || !dirty}>
            {mutation.pending ? "Salvando…" : "Salvar configurações"}
          </button>
        </div>
      </ValidatedForm>
      <div className="settings-card">
        <h2>Conectar sua impressora Bluetooth</h2>
        <ol>
          <li>
            Pareie a impressora nas configurações do dispositivo e instale o driver ou
            serviço de impressão compatível com o modelo.
          </li>
          <li>
            Se não souber o modelo, comece pelo perfil térmico de 58 ou 80 mm, conforme a
            bobina.
          </li>
          <li>
            Abra o teste e escolha “Imprimir pelo sistema”. Se a impressora não aparecer,
            baixe o PDF e abra no aplicativo recomendado pelo fabricante.
          </li>
        </ol>
        <p className="field-help">
          No Android, é necessário um serviço de impressão compatível. No iPhone/iPad, a
          impressão do sistema depende de AirPrint ou do aplicativo do fabricante; uma
          impressora Bluetooth genérica pode não ser compatível. O navegador não detecta
          automaticamente a fila, o modelo ou o papel.
        </p>
        <p className="field-help">
          Os perfis incluem Epson, Elgin, Bematech e Xprinter. São configurações iniciais
          baseadas nas referências indicadas, sem homologação física ou garantia de
          compatibilidade entre variantes.
        </p>
      </div>
      {confirm && (
        <Dialog
          title={
            confirm === "save"
              ? "Salvar configuração da loja?"
              : confirm === "remove"
                ? "Remover perfil?"
                : "Recarregar configurações?"
          }
          busy={mutation.pending}
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm === "save"
              ? "Os próximos documentos de toda a equipe usarão estes padrões. Arquivos já baixados permanecem como foram gerados."
              : confirm === "remove"
                ? `O perfil “${selected.name}” sairá do rascunho. Confirme depois em Salvar configurações para aplicar à loja.`
                : "O rascunho local será descartado e as configurações mais recentes da loja serão carregadas."}
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
                else if (confirm === "remove") {
                  if (!used.length && draft.profiles.length > 1) {
                    const profiles = draft.profiles.filter(
                      (profile) => profile.id !== selected.id,
                    )
                    setDraft((current) => ({ ...current, profiles }))
                    setProfileId(profiles[0]!.id)
                  }
                  setConfirm(null)
                } else {
                  setConfirm(null)
                  void onReload()
                }
              }}
            >
              {mutation.pending ? "Salvando…" : "Confirmar"}
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
          <p className="info-notice">
            Teste do rascunho no perfil {test.profile.name}. Nenhum pedido ou recebimento
            será criado.
          </p>
          <ReceiptPreview document={test} />
        </Dialog>
      )}
    </>
  )
}
