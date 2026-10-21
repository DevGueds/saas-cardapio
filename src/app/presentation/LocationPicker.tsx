import { memo, useCallback, useEffect, useRef, useState } from "react"
import { coordinateField } from "@cardapio/contracts"
import { parseGeoPoint, type GeoPoint } from "@cardapio/domain/delivery-radius"
import { InputField } from "../../shared/presentation/Fields"
import ReferenceMap from "./ReferenceMap"
import { useServices } from "./ServicesProvider"

const latitudeSchema = coordinateField(90),
  longitudeSchema = coordinateField(180)
function LocationPicker({
  value,
  center,
  onChange,
  disabled = false,
  title,
}: {
  value: GeoPoint | null
  center?: GeoPoint | null
  onChange(value: GeoPoint | null): void
  disabled?: boolean
  title: string
}) {
  const { deviceLocation } = useServices(),
    [coordinates, setCoordinates] = useState({
      latitude: value?.latitude.toString() ?? "",
      longitude: value?.longitude.toString() ?? "",
    }),
    [pending, setPending] = useState(false),
    [notice, setNotice] = useState(""),
    generation = useRef(0)
  useEffect(
    () => () => {
      generation.current++
    },
    [],
  )
  const choose = useCallback(
    (latitude: number, longitude: number) => {
      generation.current++
      setPending(false)
      setCoordinates({ latitude: String(latitude), longitude: String(longitude) })
      setNotice("")
      onChange(null)
    },
    [onChange],
  )
  function edit(field: "latitude" | "longitude", next: string) {
    generation.current++
    setPending(false)
    setCoordinates((previous) => ({
      ...(value
        ? { latitude: String(value.latitude), longitude: String(value.longitude) }
        : previous),
      [field]: next,
    }))
    onChange(null)
  }
  const shown = value
    ? { latitude: String(value.latitude), longitude: String(value.longitude) }
    : coordinates
  const valid =
      shown.latitude.trim() !== "" &&
      shown.longitude.trim() !== "" &&
      latitudeSchema.safeParse(shown.latitude).success &&
      longitudeSchema.safeParse(shown.longitude).success,
    latitude = valid ? Number(shown.latitude.replace(",", ".")) : null,
    longitude = valid ? Number(shown.longitude.replace(",", ".")) : null
  async function locate() {
    if (!deviceLocation || disabled) return
    const request = ++generation.current
    setPending(true)
    setNotice("")
    const result = await deviceLocation.locate()
    if (request !== generation.current) return
    setPending(false)
    if (!result.ok) {
      setNotice(result.error.message)
      return
    }
    choose(
      Number(result.value.latitude.toFixed(6)),
      Number(result.value.longitude.toFixed(6)),
    )
    setNotice(
      `Precisão estimada de ${Math.ceil(result.value.accuracy)} m. Confira se este é o ponto do endereço e ajuste no mapa se necessário.`,
    )
  }
  return (
    <fieldset className="location-picker" disabled={disabled}>
      <legend>{title}</legend>
      <p className="field-help">
        Marque a entrada do endereço. O frete será calculado pela distância em linha reta
        entre este ponto e a loja.
      </p>
      {deviceLocation && (
        <>
          <button
            type="button"
            className="secondary-button"
            disabled={pending || !!deviceLocation.unsupported()}
            onClick={() => void locate()}
          >
            {pending ? "Localizando…" : "Usar minha localização"}
          </button>
          {deviceLocation.unsupported() && (
            <p className="field-help">{deviceLocation.unsupported()}</p>
          )}
        </>
      )}
      <ReferenceMap
        latitude={latitude}
        longitude={longitude}
        center={center}
        onSelect={choose}
        selecting
        disabled={disabled}
      />
      <details className="offer-section">
        <summary>Informar coordenadas</summary>
        <div className="form-row">
          <InputField
            label="Latitude do ponto"
            inputMode="decimal"
            maxLength={20}
            schema={latitudeSchema}
            validation="coordinate"
            value={shown.latitude}
            onChange={(e) => edit("latitude", e.target.value)}
          />
          <InputField
            label="Longitude do ponto"
            inputMode="decimal"
            maxLength={20}
            schema={longitudeSchema}
            validation="coordinate"
            value={shown.longitude}
            onChange={(e) => edit("longitude", e.target.value)}
          />
        </div>
      </details>
      {notice && (
        <p className="field-help" role="status">
          {notice}
        </p>
      )}
      {value ? (
        <p className="field-help" role="status">
          Ponto confirmado. Alterar o ponto exige nova confirmação.
        </p>
      ) : (
        <button
          type="button"
          className="secondary-button"
          disabled={!valid || pending}
          onClick={() => {
            if (latitude !== null && longitude !== null)
              onChange(parseGeoPoint({ latitude, longitude }))
          }}
        >
          Confirmar ponto do endereço
        </button>
      )}
    </fieldset>
  )
}
export default memo(LocationPicker)
