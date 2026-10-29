import { memo } from "react"
import { printerProfileSchema, type PrinterProfile } from "@cardapio/contracts"
import { InputField, SelectField } from "../../../shared/presentation/Fields"
import { presetProfile, printerModels } from "../domain/printer-models"

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
      <SelectField
        label="Modelo e papel"
        value={profile.modelId}
        onChange={(event) => {
          const name = profile.name === model?.name ? undefined : profile.name
          onChange(presetProfile(event.target.value, profile.id, name))
        }}
      >
        <optgroup label="Mais usados">
          {printerModels.slice(0, 3).map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Outros modelos">
          {printerModels.slice(3).map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </optgroup>
        {!model && <option value={profile.modelId}>Modelo salvo · personalizado</option>}
      </SelectField>
      <InputField
        label="Nome da impressora"
        required
        maxLength={80}
        value={profile.name}
        onChange={(event) => onChange({ ...profile, name: event.target.value })}
      />
      <div className="printing-field-grid">
        {number("copies", "Vias por documento", 1, 5)}
        {number("fontSize", "Tamanho da letra (pt)", 8, 18, 0.5)}
      </div>
      <details className="receipt-advanced">
        <summary>Ajustes avançados</summary>
        <div className="printing-field-grid">
          {number("paperWidthMm", "Largura do papel (mm)", 40, 210)}
          {number("printableWidthMm", "Largura útil (mm)", 32, 210, 0.1)}
          {number("marginMm", "Margem mínima em cada lado (mm)", 0, 15, 0.1)}
          <SelectField
            label="Resolução térmica"
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
          Corte e avanço valem para o arquivo ESC/POS. Na impressão pelo sistema, essas
          opções pertencem ao driver.
        </p>
        {profile.cut !== "NONE" && (
          <p className="info-notice">
            O corte exige guilhotina e suporte ESC/POS no modelo da impressora.
          </p>
        )}
        {model && (
          <details className="printing-model-reference">
            <summary>Especificações do modelo</summary>
            <p className="field-help">{model.description}</p>
            <a href={model.sourceUrl} target="_blank" rel="noopener noreferrer">
              Referência do fabricante ou protocolo (nova aba)
            </a>
          </details>
        )}
      </details>
      {!validation.success && (
        <p className="field-error" role="alert">
          {validation.error.issues[0]?.message}
        </p>
      )}
    </div>
  )
}
export default memo(PrinterProfileForm)
