import type { DeviceLocation } from "../application/location"
import type { Executor } from "../application/execute"
import { Failure } from "../domain/failure"
export class BrowserLocation implements DeviceLocation {
  constructor(private readonly executor: Executor) {}
  unsupported() {
    if (!window.isSecureContext)
      return "Localização automática disponível em HTTPS ou localhost. Neste acesso, selecione o ponto no mapa."
    if (!("geolocation" in navigator))
      return "Selecione o ponto no mapa; este navegador não oferece localização automática."
    return null
  }
  locate() {
    return this.executor.run("location", "locate", async () => {
      const unsupported = this.unsupported()
      if (unsupported) throw new Failure("CAPABILITY_UNAVAILABLE", unsupported)
      return new Promise<{ latitude: number; longitude: number; accuracy: number }>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
              if (
                ![coords.latitude, coords.longitude, coords.accuracy].every(
                  Number.isFinite,
                ) ||
                Math.abs(coords.latitude) > 90 ||
                Math.abs(coords.longitude) > 180 ||
                coords.accuracy < 0
              ) {
                reject(
                  new Failure(
                    "VALIDATION",
                    "Localização inválida. Selecione o ponto no mapa.",
                  ),
                )
                return
              }
              resolve({
                latitude: coords.latitude,
                longitude: coords.longitude,
                accuracy: coords.accuracy,
              })
            },
            () =>
              reject(
                new Failure(
                  "CAPABILITY_UNAVAILABLE",
                  "Não foi possível obter sua localização. Confira a permissão do navegador ou selecione o ponto no mapa.",
                ),
              ),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
          )
        },
      )
    })
  }
}
