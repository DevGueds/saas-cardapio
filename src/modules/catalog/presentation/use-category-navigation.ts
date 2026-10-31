import { useEffect, useRef, useState } from "react"

export const categoryAnchor = (id: string) => `categoria-${id}`
export function useCategoryNavigation(ids: readonly string[], enabled: boolean) {
  const [active, setActive] = useState("")
  const navigation = useRef<HTMLElement>(null),
    initialized = useRef(false)
  const key = ids.join("|")
  useEffect(() => {
    if (!enabled) return
    const sections = key
      .split("|")
      .filter(Boolean)
      .map((id) => ({ id, node: document.getElementById(categoryAnchor(id)) }))
      .filter((entry) => entry.node)
    let frame = 0
    function update() {
      frame = 0
      const anchorMargin = sections[0]?.node
        ? parseFloat(window.getComputedStyle(sections[0].node).scrollMarginTop) || 0
        : 0
      const edge = Math.max(
        (navigation.current?.getBoundingClientRect().height ?? 64) + 18,
        anchorMargin +
          (parseFloat(
            window.getComputedStyle(document.documentElement).scrollPaddingTop,
          ) || 0) +
          2,
      )
      let current = sections[0]?.id ?? ""
      for (const section of sections)
        if (section.node!.getBoundingClientRect().top <= edge) current = section.id
      if (
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 8
      )
        current = sections[sections.length - 1]?.id ?? current
      setActive(current)
    }
    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    if (!initialized.current && sections.length) {
      initialized.current = true
      const target = sections.find(
        (section) => "#" + categoryAnchor(section.id) === window.location.hash,
      )
      if (target) target.node!.scrollIntoView({ block: "start", behavior: "auto" })
    }
    schedule()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [key, enabled])
  useEffect(() => {
    const nav = navigation.current,
      link = nav?.querySelector<HTMLElement>('[aria-current="location"]')
    if (nav && link)
      nav.scrollTo({
        left: link.offsetLeft - nav.clientWidth / 2 + link.clientWidth / 2,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      })
  }, [active])
  return { active, navigation }
}
