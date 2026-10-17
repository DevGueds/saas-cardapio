import type { ComponentProps } from "react"
import { useServices } from "./ServicesProvider"
import LocationMap from "../../shared/presentation/LocationMap"
export default function ReferenceMap(
  props: Omit<ComponentProps<typeof LocationMap>, "loadTileUrl" | "tileUrl">,
) {
  const { maps } = useServices()
  return (
    <LocationMap
      {...props}
      loadTileUrl={
        maps
          ? async () => {
              const result = await maps.configuration()
              if (!result.ok || !result.value.mapTileUrl)
                throw new Error("map_configuration_unavailable")
              return result.value.mapTileUrl
            }
          : undefined
      }
    />
  )
}
