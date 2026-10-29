export const BRAND_NAME = "Pede Aqui"
export const BRAND_SLOGAN = "Menos cliques. Mais controle."

export default function Brand({
  tagline = false,
  inverse = false,
  compact = false,
}: {
  tagline?: boolean
  inverse?: boolean
  compact?: boolean
}) {
  return (
    <span
      className={`brand-lockup${inverse ? " brand-lockup--inverse" : ""}${compact ? " brand-lockup--compact" : ""}`}
    >
      <img
        src={`${import.meta.env.BASE_URL}brand/pede-aqui-mark.svg`}
        width="48"
        height="48"
        alt=""
      />
      <span className="brand-lockup__type">
        <strong>
          {BRAND_NAME}
          <span aria-hidden="true">.</span>
        </strong>
        {tagline && <small>{BRAND_SLOGAN}</small>}
      </span>
    </span>
  )
}
