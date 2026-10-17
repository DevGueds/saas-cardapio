import { useEffect, useRef, useState } from "react"
import { MapPin } from "lucide-react"
export default function LocationMap({
  latitude,
  longitude,
  tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  loadTileUrl,
  onSelect,
}: {
  latitude: number | null
  longitude: number | null
  tileUrl?: string
  loadTileUrl?: () => Promise<string>
  onSelect?: (latitude: number, longitude: number) => void
}) {
  const [open, setOpen] = useState(false),
    [opening, setOpening] = useState(false),
    [resolvedUrl, setResolvedUrl] = useState(tileUrl),
    [failed, setFailed] = useState(false),
    container = useRef<HTMLDivElement>(null),
    select = useRef(onSelect)
  useEffect(() => {
    select.current = onSelect
  }, [onSelect])
  useEffect(() => {
    if (!open || !container.current) return
    let disposed = false,
      dispose: (() => void) | undefined
    void import("leaflet")
      .then((L) => {
        if (disposed || !container.current) return
        const center: [number, number] = [latitude ?? -14.24, longitude ?? -51.93],
          map = L.map(container.current, { scrollWheelZoom: false }).setView(
            center,
            latitude === null ? 4 : 14,
          )
        const tiles = L.tileLayer(resolvedUrl, {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        }).addTo(map)
        tiles.on("tileerror", () => setFailed(true))
        let marker =
          latitude !== null && longitude !== null
            ? L.circleMarker(center, {
                radius: 9,
                color: "#225b45",
                fillOpacity: 0.8,
              }).addTo(map)
            : null
        if (select.current)
          map.on("click", (event) => {
            if (marker) marker.setLatLng(event.latlng)
            else
              marker = L.circleMarker(event.latlng, {
                radius: 9,
                color: "#225b45",
                fillOpacity: 0.8,
              }).addTo(map)
            select.current?.(
              Number(event.latlng.lat.toFixed(6)),
              Number(event.latlng.lng.toFixed(6)),
            )
          })
        dispose = () => map.remove()
      })
      .catch(() => setFailed(true))
    return () => {
      disposed = true
      dispose?.()
    }
  }, [open, resolvedUrl, latitude, longitude])
  async function show() {
    setOpening(true)
    setFailed(false)
    try {
      setResolvedUrl(loadTileUrl ? await loadTileUrl() : tileUrl)
      setOpen(true)
    } catch {
      setFailed(true)
    } finally {
      setOpening(false)
    }
  }
  return (
    <div className="location-map">
      {!open ? (
        <button
          type="button"
          className="secondary-button"
          disabled={opening}
          onClick={() => void show()}
        >
          <MapPin size={18} /> {opening ? "Carregando mapa…" : "Ver mapa de referência"}
        </button>
      ) : (
        <>
          <div
            ref={container}
            className="map-canvas"
            role="region"
            aria-label="Mapa de referência da região"
          />
          {failed && (
            <p className="field-help">
              O mapa não pôde ser carregado completamente. Você pode continuar pelos
              campos de endereço.
            </p>
          )}
          <small className="field-help">
            {onSelect
              ? "Clique para marcar uma referência. Você também pode preencher latitude e longitude abaixo. "
              : "Localização aproximada da região. "}
            O mapa não define o frete e não mostra o entregador.
          </small>
        </>
      )}
      {failed && !open && (
        <p className="field-help" role="status">
          Mapa indisponível. Continue pelos campos de endereço ou tente novamente.
        </p>
      )}
    </div>
  )
}
