import { useState } from "react"
import { UtensilsCrossed } from "lucide-react"

export default function ImageWithFallback({
  src,
  alt,
  className = "",
}: {
  src: string
  alt: string
  className?: string
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  if (!src || failedSource === src)
    return (
      <span
        className={`image-placeholder ${className}`}
        role={alt ? "img" : undefined}
        aria-label={alt ? `${alt} — imagem indisponível` : undefined}
      >
        <UtensilsCrossed size={30} />
      </span>
    )
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailedSource(src)}
    />
  )
}
