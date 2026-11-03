import { expect, type Locator } from "@playwright/test"

/** Resolves solid/alpha backgrounds through ancestors. Inspect gradients separately. */
export async function expectReadableText(locator: Locator, minimum = 4.5) {
  for (const element of await locator.all()) {
    if (!(await element.isVisible())) continue
    const result = await element.evaluate((node) => {
      const rgba = (value: string) => {
        const channels = value.match(/[\d.]+/g)!.map(Number)
        return [channels[0]!, channels[1]!, channels[2]!, channels[3] ?? 1]
      }
      const over = (front: number[], back: number[]) =>
        front
          .slice(0, 3)
          .map((channel, index) => channel * front[3]! + back[index]! * (1 - front[3]!))
      const ancestors: Element[] = []
      for (let current: Element | null = node; current; current = current.parentElement)
        ancestors.unshift(current)
      let background = [255, 255, 255]
      for (const ancestor of ancestors)
        background = over(rgba(getComputedStyle(ancestor).backgroundColor), background)
      const style = getComputedStyle(node)
      const foreground = over(rgba(style.color), background)
      const luminance = (color: number[]) =>
        color
          .map((channel) => channel / 255)
          .map((channel) =>
            channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
          )
          .reduce(
            (sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!,
            0,
          )
      const a = luminance(foreground),
        b = luminance(background)
      return {
        text: node.textContent?.trim(),
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        color: style.color,
        background,
      }
    })
    expect(result.ratio, JSON.stringify(result)).toBeGreaterThanOrEqual(minimum)
  }
}
