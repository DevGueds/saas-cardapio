import { memo, useCallback, type ComponentProps } from "react"
import { useServices } from "./ServicesProvider"
import LocationMap from "../../shared/presentation/LocationMap"
function ReferenceMap(
  props: Omit<ComponentProps<typeof LocationMap>, "loadTileUrl" | "tileUrl">,
) {
  const { maps } = useServices()
  const loadTileUrl = useCallback(async () => {
    if (!maps) return "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    const result = await maps.configuration()
    if (!result.ok || !result.value.mapTileUrl)
      throw new Error("map_configuration_unavailable")
    return result.value.mapTileUrl
  }, [maps])
  return <LocationMap {...props} loadTileUrl={loadTileUrl} />
}
export default memo(ReferenceMap)
