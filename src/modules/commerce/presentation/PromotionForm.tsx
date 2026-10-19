import { moneyField, integerTextField, localDateTimeField } from "@cardapio/contracts"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import type { FormEvent } from "react"
import type { Promotion } from "@cardapio/domain/commerce"
import { moneyInput, parseMoney } from "@cardapio/domain/money"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useFormDraft } from "../../../app/presentation/use-form-draft"
import Dialog from "../../../shared/presentation/Dialog"
import DraftNotice from "../../../shared/presentation/DraftNotice"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import {
  InputField,
  SelectField,
  ToggleField,
  FormActions,
} from "../../../shared/presentation/Fields"
import { useMutation } from "../../../shared/presentation/use-mutation"
import { promotionDraftSchema, dateInput, isoDate } from "../application/offer-drafts"
export default function PromotionForm({
  promotion,
  onClose,
  onSaved,
}: {
  promotion?: Promotion
  onClose(): void
  onSaved(): void
}) {
  const { menu, reload } = useMenu(),
    { commerce, ids } = useServices(),
    mutation = useMutation()
  const draft = useFormDraft(
    `promotion:${promotion?.id ?? "new"}`,
    {
      revision: menu.revision,
      id: promotion?.id ?? ids.next(),
      name: promotion?.name ?? "",
      code: promotion?.code ?? "",
      kind: promotion?.kind ?? "PERCENT",
      value: promotion
        ? promotion.kind === "PERCENT"
          ? String(promotion.value)
          : moneyInput(promotion.value)
        : "10",
      minSubtotal: moneyInput(promotion?.minSubtotal ?? 0),
      maxDiscount: moneyInput(promotion?.maxDiscount ?? 0),
      includeCombos: promotion?.includeCombos ?? false,
      active: promotion?.active ?? true,
      startsAt: dateInput(promotion?.startsAt ?? new Date().toISOString()),
      endsAt: dateInput(
        promotion?.endsAt ?? new Date(Date.now() + 7 * 86400000).toISOString(),
      ),
      maxUses: String(promotion?.maxUses ?? 0),
    },
    promotionDraftSchema.parse,
  )
  const value = draft.value,
    field = <K extends keyof typeof value>(key: K, next: (typeof value)[K]) =>
      draft.set((v) => ({ ...v, [key]: next }))
  async function refresh() {
    const latest = await reload()
    if (latest) field("revision", latest.revision)
    mutation.clearError()
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!commerce) return
    const result = await mutation.run(async () =>
      commerce.promotion(menu.restaurant.id, value.revision, {
        id: value.id,
        name: value.name,
        code: value.code.trim().toUpperCase(),
        kind: value.kind,
        value:
          value.kind === "FREE_DELIVERY"
            ? 0
            : value.kind === "PERCENT"
              ? Number(value.value)
              : parseMoney(value.value, "value", true),
        minSubtotal: parseMoney(value.minSubtotal, "minSubtotal"),
        maxDiscount: parseMoney(value.maxDiscount, "maxDiscount"),
        includeCombos: value.includeCombos,
        active: value.active,
        startsAt: isoDate(value.startsAt),
        endsAt: isoDate(value.endsAt),
        maxUses: Number(value.maxUses),
      }),
    )
    if (result?.ok) {
      draft.clear()
      onSaved()
    }
  }
  return (
    <Dialog
      title={promotion ? "Editar promoção" : "Nova promoção"}
      onClose={onClose}
      busy={mutation.pending}
    >
      <ValidatedForm className="editor-form" onSubmit={(e) => void submit(e)}>
        <DraftNotice draft={draft} />
        <p className="form-intro">
          Uma promoção por pedido. Sem código, a melhor oferta válida é aplicada
          automaticamente.
        </p>
        {mutation.error && (
          <ErrorNotice error={mutation.error} onRetry={() => void refresh()} />
        )}
        {value.revision !== menu.revision && (
          <div className="info-notice">
            As ofertas mudaram.{" "}
            <button type="button" onClick={() => void refresh()}>
              Atualizar e revisar
            </button>
          </div>
        )}
        <fieldset disabled={mutation.pending}>
          <InputField
            label="Nome da promoção"
            required
            maxLength={120}
            validation="name"
            value={value.name}
            placeholder="Semana do hambúrguer"
            onChange={(e) => field("name", e.target.value)}
          />
          <div className="form-row">
            <SelectField
              label="Benefício"
              value={value.kind}
              onChange={(e) => field("kind", e.target.value as Promotion["kind"])}
            >
              <option value="PERCENT">Desconto em porcentagem</option>
              <option value="FIXED">Desconto em reais</option>
              <option value="FREE_DELIVERY">Entrega grátis</option>
            </SelectField>
            {value.kind !== "FREE_DELIVERY" && (
              <InputField
                label={value.kind === "PERCENT" ? "Desconto (%)" : "Desconto (R$)"}
                required
                inputMode="decimal"
                maxLength={20}
                validation={value.kind === "FIXED" ? "money" : undefined}
                schema={
                  value.kind === "PERCENT" ? integerTextField(1, 100) : moneyField(true)
                }
                value={value.value}
                onChange={(e) => field("value", e.target.value)}
              />
            )}
          </div>
          <InputField
            label="Código do cupom (opcional)"
            maxLength={30}
            validation="coupon"
            value={value.code}
            placeholder="Ex.: BEMVINDO10"
            help="Deixe vazio para aplicar automaticamente. Letras, números, - e _."
            onChange={(e) => field("code", e.target.value.toUpperCase())}
          />
          <div className="form-row">
            <InputField
              label="Começa em"
              type="datetime-local"
              required
              value={value.startsAt}
              onChange={(e) => field("startsAt", e.target.value)}
            />
            <InputField
              label="Termina em"
              type="datetime-local"
              required
              schema={localDateTimeField.refine(
                (v) =>
                  !localDateTimeField.safeParse(value.startsAt).success ||
                  Date.parse(v) > Date.parse(value.startsAt),
                "O término deve ser posterior ao início da promoção.",
              )}
              value={value.endsAt}
              onChange={(e) => field("endsAt", e.target.value)}
            />
          </div>
          <small className="field-help">Horário local deste dispositivo.</small>
          <details className="offer-section" open>
            <summary>Condições da oferta</summary>
            <div className="form-row">
              <InputField
                label="Pedido mínimo (R$)"
                required
                inputMode="decimal"
                validation="money"
                maxLength={20}
                value={value.minSubtotal}
                onChange={(e) => field("minSubtotal", e.target.value)}
                help="Valor dos itens, antes do frete."
              />
              <InputField
                label="Desconto máximo (R$)"
                required
                inputMode="decimal"
                validation="money"
                maxLength={20}
                value={value.maxDiscount}
                onChange={(e) => field("maxDiscount", e.target.value)}
                help="0 = sem teto adicional. Não se aplica à entrega grátis."
              />
            </div>
            <InputField
              label="Limite total de usos"
              type="number"
              min={0}
              max={1000000}
              required
              schema={integerTextField(0, 1000000).refine(
                (v) => Number(v) === 0 || Number(v) >= (promotion?.used ?? 0),
                "O limite não pode ser menor que os usos já realizados.",
              )}
              value={value.maxUses}
              onChange={(e) => field("maxUses", e.target.value)}
              help={`0 = sem limite. Já utilizada ${promotion?.used ?? 0} vez(es); cancelamentos não devolvem usos.`}
            />
            {value.kind !== "FREE_DELIVERY" && (
              <ToggleField
                label="Aplicar também aos combos"
                checked={value.includeCombos}
                onChange={(v) => field("includeCombos", v)}
              />
            )}
          </details>
          <ToggleField
            label="Promoção ativa"
            checked={value.active}
            onChange={(v) => field("active", v)}
          />
        </fieldset>
        <FormActions busy={mutation.pending} onCancel={onClose} label="Salvar promoção" />
      </ValidatedForm>
    </Dialog>
  )
}
