import { useId, type ReactNode } from "react"

export default function FormSection({
  number,
  title,
  description,
  children,
}: {
  number: string
  title: string
  description: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section className="form-section" aria-labelledby={id}>
      <header className="form-section__heading">
        <span className="section-number" aria-hidden="true">
          {number}
        </span>
        <div>
          <h2 id={id}>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      <div className="form-section__body">{children}</div>
    </section>
  )
}
