import { Clock3, MapPin, ArrowUpRight } from "lucide-react"
import { localClock, weekDayNames } from "@cardapio/domain/store-hours"
import type { Restaurant } from "@cardapio/domain/restaurant"
import ReferenceMap from "../../../app/presentation/ReferenceMap"

export default function StoreInformation({
  store,
  now,
}: {
  store: Restaurant
  now: number
}) {
  const hours = store.hours
  const local = hours ? localClock(now, hours.timeZone) : null
  const day = local ? new Date(local.date + "T12:00:00Z").getUTCDay() : -1
  const exceptions =
    hours?.exceptions.filter(
      (entry) =>
        entry.date === local?.date ||
        (entry.yearly && entry.date.slice(5) === local?.date.slice(5)),
    ) ?? []
  const target = store.location
    ? `${store.location.latitude},${store.location.longitude}`
    : store.address
  return (
    <div className="store-information">
      {hours && (hours.enabled || hours.weekly.some((intervals) => intervals.length > 0) || hours.exceptions.length > 0) && (
        <details className="store-information__panel">
          <summary>
            <Clock3 size={19} aria-hidden="true" />
            <span>
              <strong>Horários de funcionamento</strong>
              <small>Toque para ver os dias e horários</small>
            </span>
          </summary>
          <div className="store-information__content">
            {exceptions.map((entry) => (
              <p key={entry.date} className="info-notice">
                Hoje: {entry.label || "horário especial"} ·{" "}
                {entry.intervals.length
                  ? entry.intervals.map((i) => `${i.opensAt}–${i.closesAt}`).join(" e ")
                  : "Fechado"}
              </p>
            ))}
            <dl className="store-weekly-hours">
              {hours.weekly.map((intervals, index) => (
                <div key={index} className={index === day ? "is-today" : ""}>
                  <dt>
                    {weekDayNames[index]}
                    {index === day ? " · Hoje" : ""}
                  </dt>
                  <dd>
                    {intervals.length
                      ? intervals
                          .map(
                            (interval) =>
                              `${interval.opensAt}–${interval.closesAt}${interval.closesAt < interval.opensAt ? " (dia seguinte)" : ""}`,
                          )
                          .join(" / ")
                      : "Fechado"}
                  </dd>
                </div>
              ))}
            </dl>
            <small className="field-help">
              {new Intl.DateTimeFormat("pt-BR", { timeZone: hours.timeZone, timeZoneName: "long" }).formatToParts(now).find((part) => part.type === "timeZoneName")?.value}
              {hours.enabled
                ? ""
                : " · A disponibilidade dos pedidos é atualizada pela loja."}
            </small>
          </div>
        </details>
      )}
      {(store.address || store.location) && (
        <details className="store-information__panel">
          <summary>
            <MapPin size={19} aria-hidden="true" />
            <span>
              <strong>Onde estamos</strong>
              <small>{store.address || "Ver localização no mapa"}</small>
            </span>
          </summary>
          <div className="store-information__content">
            {store.address && <address>{store.address}</address>}
            {store.location && (
              <ReferenceMap
                latitude={store.location.latitude}
                longitude={store.location.longitude}
                label="Ver mapa da loja"
                help="Localização informada pelo estabelecimento. Confira o endereço antes de sair."
              />
            )}
            <a
              className="secondary-button"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir no aplicativo de mapas <ArrowUpRight size={17} aria-hidden="true" />
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </div>
        </details>
      )}
    </div>
  )
}
