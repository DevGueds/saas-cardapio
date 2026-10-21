import { memo, useEffect, useRef, useState } from "react"
import type { Map as LeafletMap, CircleMarker, LatLngExpression } from "leaflet"
import { MapPin } from "lucide-react"

function LocationMap({
  latitude,
  longitude,
  center,
  tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  loadTileUrl,
  onSelect,
  selecting = false,
  disabled = false,
  label,
  help,
}: {
  latitude: number | null
  longitude: number | null
  center?: { latitude: number; longitude: number } | null
  tileUrl?: string
  loadTileUrl?: () => Promise<string>
  onSelect?: (latitude: number, longitude: number) => void
  selecting?: boolean
  disabled?: boolean
  label?: string
  help?: string
}) {
  const [open, setOpen] = useState(false),
    [opening, setOpening] = useState(false),
    [resolvedUrl, setResolvedUrl] = useState(tileUrl),
    [failed, setFailed] = useState(false),
    container = useRef<HTMLDivElement>(null),
    mapRef = useRef<LeafletMap | null>(null),
    markerRef = useRef<CircleMarker | null>(null),
    latest = useRef({ latitude, longitude, center, onSelect, disabled })
  useEffect(() => {
    latest.current = { latitude, longitude, center, onSelect, disabled }
  }, [latitude, longitude, center, onSelect, disabled])
  useEffect(() => {
    if (!open || !container.current) return
    let disposed = false
    void import("leaflet")
      .then((L) => {
        if (disposed || !container.current) return
        const point = latest.current,
          origin: LatLngExpression = [
            point.latitude ?? point.center?.latitude ?? -14.24,
            point.longitude ?? point.center?.longitude ?? -51.93,
          ],
          map = L.map(container.current, { scrollWheelZoom: false }).setView(
            origin,
            point.latitude !== null || point.center ? 15 : 4,
          )
        mapRef.current = map
        const tiles = L.tileLayer(resolvedUrl, {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        }).addTo(map)
        tiles.on("tileerror", () => {
          if (!disposed) setFailed(true)
        })
        if (point.latitude !== null && point.longitude !== null)
          markerRef.current = L.circleMarker([point.latitude, point.longitude], {
            radius: 9,
            color: "#225b45",
            fillOpacity: 0.8,
          }).addTo(map)
        map.on("click", (event) => {
          if (latest.current.disabled || !latest.current.onSelect) return
          if (markerRef.current) markerRef.current.setLatLng(event.latlng)
          else
            markerRef.current = L.circleMarker(event.latlng, {
              radius: 9,
              color: "#225b45",
              fillOpacity: 0.8,
            }).addTo(map)
          latest.current.onSelect(
            Number(event.latlng.lat.toFixed(6)),
            Number(event.latlng.lng.toFixed(6)),
          )
        })
      })
      .catch(() => {
        if (!disposed) setFailed(true)
      })
    return () => {
      disposed = true
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [open, resolvedUrl])
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (latitude === null || longitude === null) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    const coordinates: [number, number] = [latitude, longitude]
    if (markerRef.current) {
      markerRef.current.setLatLng(coordinates)
      map.panTo(coordinates, { animate: false })
      return
    }
    let active = true
    void import("leaflet").then((L) => {
      if (!active || mapRef.current !== map) return
      markerRef.current = L.circleMarker(coordinates, {
        radius: 9,
        color: "#225b45",
        fillOpacity: 0.8,
      }).addTo(map)
      map.panTo(coordinates, { animate: false })
    })
    return () => {
      active = false
    }
  }, [latitude, longitude])
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
          disabled={opening || disabled}
          onClick={() => void show()}
        >
          <MapPin size={18} />{" "}
          {opening
            ? "Carregando mapa…"
            : (label ??
              (selecting ? "Selecionar ponto no mapa" : "Ver mapa de referência"))}
        </button>
      ) : (
        <>
          <div
            ref={container}
            className="map-canvas"
            role="region"
            aria-label={
              selecting
                ? "Mapa para selecionar localização"
                : "Mapa de referência da região"
            }
          />
          {onSelect && (
            <button
              type="button"
              className="secondary-button"
              disabled={disabled}
              onClick={() => {
                const point = mapRef.current?.getCenter()
                if (point)
                  onSelect(Number(point.lat.toFixed(6)), Number(point.lng.toFixed(6)))
              }}
            >
              Usar centro do mapa
            </button>
          )}
          {failed && (
            <p className="field-help">
              O mapa não pôde ser carregado completamente. Você pode preencher as
              coordenadas.
            </p>
          )}
          <small className="field-help">
            {help ??
              (selecting
                ? "Clique no ponto desejado ou mova o mapa com as setas e use o centro. Confira o endereço antes de confirmar."
                : `${onSelect ? "Clique para marcar uma referência. Você também pode preencher latitude e longitude. " : "Localização aproximada da região. "}O mapa não define o frete e não mostra o entregador.`)}
          </small>
        </>
      )}
      {failed && !open && (
        <p className="field-help" role="status">
          Mapa indisponível. Preencha as coordenadas ou tente novamente.
        </p>
      )}
    </div>
  )
}
export default memo(LocationMap)
