import { Failure } from "@cardapio/domain/failure"
export class Bulkhead {
  private active = 0
  constructor(private readonly maximum: number) {}
  enter() {
    if (this.active >= this.maximum)
      throw new Failure(
        "CAPABILITY_UNAVAILABLE",
        "A loja está recebendo muitas solicitações. Tente novamente em instantes.",
        {},
        "concurrency_limit",
      )
    this.active++
    let released = false
    return () => {
      if (!released) {
        released = true
        this.active--
      }
    }
  }
  get inFlight() {
    return this.active
  }
  async run<T>(action: () => Promise<T>) {
    const release = this.enter()
    try {
      return await action()
    } finally {
      release()
    }
  }
}
