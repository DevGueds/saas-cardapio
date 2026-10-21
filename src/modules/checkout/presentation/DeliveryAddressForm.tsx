import { memo, useMemo } from "react"
import { addressTextField, brazilianStates } from "@cardapio/contracts"
import {
  type DeliveryAddress,
  type AddressTextField,
} from "@cardapio/domain/delivery-address"
import { InputField, SelectField, ToggleField } from "../../../shared/presentation/Fields"

function DeliveryAddressForm({
  value,
  onChange,
  regionLocked,
}: {
  value: DeliveryAddress
  onChange(value: DeliveryAddress): void
  regionLocked: boolean
}) {
  const rules = useMemo(
    () =>
      Object.fromEntries(
        (
          [
            "street",
            "number",
            "complement",
            "neighborhood",
            "city",
            "state",
            "reference",
          ] as const
        ).map((field) => [
          field,
          addressTextField(field, { noNumber: value.noNumber, kind: value.kind }),
        ]),
      ),
    [value.noNumber, value.kind],
  )
  const field = (
    name: AddressTextField,
    label: string,
    maxLength: number,
    required: boolean,
    autoComplete: string,
    help?: string,
  ) => (
    <InputField
      label={label}
      name={`delivery-${name}`}
      required={required}
      maxLength={maxLength}
      autoComplete={autoComplete}
      autoCapitalize="words"
      schema={rules[name]}
      readOnly={regionLocked && ["city", "state", "neighborhood"].includes(name)}
      disabled={name === "number" && value.noNumber}
      value={value[name]}
      onChange={(event) => onChange({ ...value, [name]: event.target.value })}
      help={help}
    />
  )
  return (
    <section className="delivery-address-fields" aria-label="Endereço de entrega">
      <h4>Onde entregar?</h4>
      {field(
        "street",
        "Rua, avenida ou estrada",
        200,
        true,
        "section-customer shipping address-line1",
        "Informe o nome completo do logradouro.",
      )}
      <div className="form-row">
        {field(
          "number",
          "Número do imóvel",
          20,
          !value.noNumber,
          "off",
          "Ex.: 123 ou 123-A.",
        )}
        <div className="address-number-option">
          <ToggleField
            label="Sem número"
            checked={value.noNumber}
            onChange={(noNumber) =>
              onChange({ ...value, noNumber, number: noNumber ? "" : value.number })
            }
          />
        </div>
      </div>
      <SelectField
        label="Tipo de local"
        name="delivery-kind"
        value={value.kind}
        onChange={(event) =>
          onChange({ ...value, kind: event.target.value as DeliveryAddress["kind"] })
        }
      >
        <option value="HOUSE">Casa</option>
        <option value="APARTMENT">Apartamento ou condomínio</option>
        <option value="BUSINESS">Comércio</option>
        <option value="OTHER">Outro</option>
      </SelectField>
      {field(
        "complement",
        "Complemento / bloco / apartamento",
        120,
        value.kind === "APARTMENT",
        "section-customer shipping address-line2",
        value.kind === "APARTMENT"
          ? "Identifique o bloco, apartamento ou unidade para o entregador."
          : "Opcional. Ex.: fundos, bloco B ou sala 12.",
      )}
      {regionLocked && (
        <p className="field-help">
          Bairro, cidade e UF seguem a região de entrega selecionada acima.
        </p>
      )}
      {field(
        "neighborhood",
        "Bairro do endereço",
        120,
        true,
        "section-customer shipping address-level3",
      )}
      <div className="form-row">
        {field(
          "city",
          "Cidade do endereço",
          120,
          true,
          "section-customer shipping address-level2",
        )}
        {regionLocked ? (
          field(
            "state",
            "UF do endereço",
            2,
            true,
            "section-customer shipping address-level1",
          )
        ) : (
          <SelectField
            label="UF do endereço"
            name="delivery-state"
            autoComplete="section-customer shipping address-level1"
            required
            value={value.state}
            onChange={(event) => onChange({ ...value, state: event.target.value })}
          >
            <option value="">Selecione</option>
            {brazilianStates.map((state) => (
              <option key={state}>{state}</option>
            ))}
          </SelectField>
        )}
      </div>
      {field(
        "reference",
        "Ponto de referência",
        160,
        value.noNumber,
        "off",
        value.noNumber
          ? "Obrigatório para imóvel sem número. Ex.: portão azul ao lado da escola."
          : "Opcional. Ajude a identificar a entrada; não substitui rua e número.",
      )}
    </section>
  )
}
export default memo(DeliveryAddressForm)
