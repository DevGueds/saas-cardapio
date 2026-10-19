import { z } from "zod"
import QRCode from "qrcode"
import { Failure } from "@cardapio/domain/failure"
import type { WhatsappState } from "@cardapio/contracts"
import type { TenantScope } from "../../identity/domain/identity.js"
import type { WhatsappProvider } from "../application/ports.js"
export class EvolutionWhatsapp implements WhatsappProvider {
  readonly configured: boolean
  constructor(
    private readonly base: string,
    private readonly key: string,
  ) {
    this.configured = !!base && !!key
  }
  private instance(scope: TenantScope) {
    return `cardapio-${scope.restaurantId}`
  }
  private async request(path: string, method = "GET", body?: unknown) {
    if (!this.configured)
      throw new Failure(
        "CONFIGURATION",
        "Configure o provedor de WhatsApp neste ambiente.",
      )
    try {
      const response = await fetch(`${this.base}${path}`, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(10000),
        headers: {
          apikey: this.key,
          "Content-Type": "application/json",
          origin: "http://cardapio-internal",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      if (Number(response.headers.get("content-length") ?? 0) > 1_000_000) {
        await response.body?.cancel()
        throw new Error("provider_response_size")
      }
      const text = await response.text()
      if (text.length > 1_000_000) throw new Error("provider_response_size")
      let data: unknown = null
      try {
        data = JSON.parse(text)
      } catch {
        /* An invalid reply cannot confirm delivery. */
      }
      return { status: response.status, ok: response.ok, data }
    } catch {
      throw new Failure(
        "CAPABILITY_UNAVAILABLE",
        "O WhatsApp não respondeu. Confira a conexão da loja e tente novamente.",
        {},
        "whatsapp_provider_unavailable",
      )
    }
  }
  async state(scope: TenantScope): Promise<WhatsappState> {
    if (!this.configured) return { state: "unconfigured", qr: null }
    const response = await this.request(
      `/instance/connectionState/${this.instance(scope)}`,
    )
    if (response.status === 404) return { state: "disconnected", qr: null }
    const parsed = z
      .object({
        instance: z.object({ state: z.enum(["open", "close", "connecting", "closed"]) }),
      })
      .safeParse(response.data)
    if (!response.ok || !parsed.success)
      throw new Failure(
        "CAPABILITY_UNAVAILABLE",
        "Não foi possível consultar a conexão do WhatsApp.",
      )
    return {
      state:
        parsed.data.instance.state === "open"
          ? "connected"
          : parsed.data.instance.state === "connecting"
            ? "connecting"
            : "disconnected",
      qr: null,
    }
  }
  async connect(scope: TenantScope): Promise<WhatsappState> {
    const instance = this.instance(scope),
      current = await this.request(`/instance/connectionState/${instance}`)
    if (current.status === 404) {
      const created = await this.request("/instance/create", "POST", {
        instanceName: instance,
        integration: "WHATSAPP-BAILEYS",
        qrcode: false,
        groupsIgnore: true,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false,
      })
      if (!created.ok && created.status !== 403)
        throw new Failure(
          "CAPABILITY_UNAVAILABLE",
          "Não foi possível preparar a conexão do WhatsApp.",
        )
    } else if (!current.ok)
      throw new Failure(
        "CAPABILITY_UNAVAILABLE",
        "Não foi possível acessar o provedor de WhatsApp.",
      )
    const connected = await this.state(scope)
    if (connected.state === "connected") return connected
    const response = await this.request(`/instance/connect/${instance}`)
    const parsed = z
      .object({
        base64: z.string().max(200000).optional(),
        code: z.string().max(3000).optional(),
      })
      .safeParse(response.data)
    if (!response.ok || !parsed.success)
      throw new Failure(
        "CAPABILITY_UNAVAILABLE",
        "Não foi possível gerar o QR de conexão. Tente novamente.",
      )
    const qr =
      parsed.data.base64 &&
      /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(parsed.data.base64)
        ? parsed.data.base64
        : parsed.data.code
          ? await QRCode.toDataURL(parsed.data.code, {
              errorCorrectionLevel: "M",
              margin: 4,
              width: 400,
            })
          : null
    return { state: "connecting", qr }
  }
  async disconnect(scope: TenantScope) {
    const response = await this.request(
      `/instance/logout/${this.instance(scope)}`,
      "DELETE",
    )
    if (!response.ok && response.status !== 404)
      throw new Failure(
        "CAPABILITY_UNAVAILABLE",
        "Não foi possível desconectar o WhatsApp.",
      )
  }
  async send(
    scope: TenantScope,
    number: string,
    text: string,
  ): Promise<"SENT" | "FAILED" | "UNKNOWN"> {
    try {
      const response = await this.request(
        `/message/sendText/${this.instance(scope)}`,
        "POST",
        { number, text, linkPreview: false },
      )
      if (
        response.ok &&
        z.object({ key: z.object({ id: z.string().min(1) }) }).safeParse(response.data)
          .success
      )
        return "SENT"
      return response.status >= 400 && response.status < 500 ? "FAILED" : "UNKNOWN"
    } catch {
      return "UNKNOWN"
    }
  }
}
