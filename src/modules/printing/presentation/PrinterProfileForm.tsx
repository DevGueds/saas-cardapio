import { memo } from "react"
import type { PrinterProfile } from "@cardapio/contracts"
import { printerProfileSchema } from "@cardapio/contracts"
import { InputField, SelectField } from "../../../shared/presentation/Fields"
import { printerModels } from "../domain/printer-models"

function PrinterProfileForm({
  profile,
  onChange,
}: {
  profile: PrinterProfile
  onChange(profile: PrinterProfile): void
}) {
  const model = printerModels.find((entry) => entry.id === profile.modelId)
  const number = (
    key:
      | "paperWidthMm"
      | "printableWidthMm"
      | "marginMm"
      | "fontSize"
      | "copies"
      | "feedLines",
    label: string,
    min: number,
    max: number,
    step = 1,
  ) => (
    <InputField
      label={label}
      type="number"
      min={min}
      max={max}
      step={step}
      required
      value={Number.isFinite(profile[key]) ? profile[key] : ""}
      onChange={(event) =>
        onChange({
          ...profile,
          [key]: event.target.value === "" ? NaN : Number(event.target.value),
        })
      }
    />
  )
  const validation = printerProfileSchema.safeParse(profile)
  return (
    <div className="printer-profile-form">
      <InputField
        label="Nome do perfil"
        required
        maxLength={80}
        value={profile.name}
        onChange={(event) => onChange({ ...profile, name: event.target.value })}
      />
      {model && (
        <p className="field-help">
          Base: {model.name}. {model.description}{" "}
          <a href={model.sourceUrl} target="_blank" rel="noopener noreferrer">
            Consultar referência do perfil (nova aba)
          </a>
        </p>
      )}
      <div className="printing-field-grid">
        {number("paperWidthMm", "Largura do papel (mm)", 40, 210)}
        {number("printableWidthMm", "Largura útil (mm)", 32, 210, 0.1)}
        {number("fontSize", "Tamanho da letra (pt)", 8, 18, 0.5)}
        {number("copies", "Vias por documento", 1, 5)}
      </div>
      <details className="receipt-advanced">
        <summary>Ajustes de margem e comandos térmicos</summary>
        <div className="printing-field-grid">
          {number("marginMm", "Margem mínima em cada lado (mm)", 0, 15, 0.1)}
          <SelectField
            label="Resolução para ESC/POS"
            value={profile.dpi}
            onChange={(event) =>
              onChange({
                ...profile,
                dpi: Number(event.target.value) as PrinterProfile["dpi"],
              })
            }
          >
            <option value={180}>180 dpi</option>
            <option value={203}>203 dpi</option>
            <option value={300}>300 dpi</option>
          </SelectField>
          <SelectField
            label="Corte no arquivo ESC/POS"
            value={profile.cut}
            onChange={(event) =>
              onChange({ ...profile, cut: event.target.value as PrinterProfile["cut"] })
            }
          >
            <option value="NONE">Sem corte automático</option>
            <option value="PARTIAL">Corte parcial</option>
            <option value="FULL">Corte total</option>
          </SelectField>
          {number("feedLines", "Avanço final (linhas, ESC/POS)", 0, 8)}
        </div>
        <p className="field-help">
          A largura útil fica centralizada no papel, respeitando a margem mínima. Corte e
          avanço só valem para o arquivo ESC/POS; na impressão pelo sistema, configure
          essas opções no driver.
        </p>
        {profile.cut !== "NONE" && (
          <p className="info-notice">
            Ative o corte somente se sua impressora tiver guilhotina e suportar esse
            comando ESC/POS. Modelos Bluetooth portáteis frequentemente usam corte manual.
          </p>
        )}
      </details>
      {!validation.success && (
        <p className="field-error" role="alert">
          Revise o perfil: {validation.error.issues[0]?.message}
        </p>
      )}
    </div>
  )
}
export default memo(PrinterProfileForm)
