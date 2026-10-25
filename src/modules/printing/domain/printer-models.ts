import type { PrinterProfile } from "@cardapio/domain/printing"

export interface PrinterModel {
  id: string
  name: string
  description: string
  sourceUrl: string
  settings: Omit<PrinterProfile, "id" | "name" | "modelId">
}

const thermal = (
  paperWidthMm: number,
  printableWidthMm: number,
): PrinterModel["settings"] => ({
  paperWidthMm,
  printableWidthMm,
  marginMm: Math.min(2, (paperWidthMm - printableWidthMm) / 2),
  fontSize: 10,
  copies: 1,
  dpi: 203,
  cut: "NONE",
  feedLines: 3,
})

/** Suggested geometry, not a promise of driver, Bluetooth or ESC/POS compatibility. */
export const printerModels: readonly PrinterModel[] = [
  {
    id: "generic-58",
    name: "Térmica / Bluetooth 58 mm",
    description:
      "Modelo desconhecido: comece com 48 mm úteis e calibre. Bluetooth não confirma o protocolo ESC/POS nem suporte pelo navegador.",
    sourceUrl: "https://developer.chrome.com/blog/serial-over-bluetooth",
    settings: thermal(58, 48),
  },
  {
    id: "generic-80",
    name: "Térmica / Bluetooth 80 mm",
    description:
      "Modelo desconhecido: 72 mm úteis como sugestão inicial. Instale o driver ou serviço de impressão compatível e confira uma página de teste.",
    sourceUrl: "https://developer.chrome.com/blog/serial-over-bluetooth",
    settings: thermal(80, 72),
  },
  {
    id: "a4",
    name: "Laser / jato de tinta A4",
    description:
      "PDF e diálogo do sistema em papel A4. Selecione o papel correto e escala de 100% no driver.",
    sourceUrl: "https://developer.mozilla.org/en-US/docs/Web/CSS/@page/size",
    settings: { ...thermal(210, 190), marginMm: 10, dpi: 300, feedLines: 0 },
  },
  {
    id: "epson-tm-t20x",
    name: "Epson TM-T20X · 80 mm",
    description:
      "TM-T20X original: papel 79,5 ± 0,5 mm, área útil 72 mm, 203 dpi e ESC/POS. O manual deste modelo não especifica bobina de 58 mm. Drivers Windows, Mac e Linux; confira versão e interface.",
    sourceUrl: "https://download4.epson.biz/sec_pubs/bs/pdf/TM-T20X_trg_en_revD.pdf",
    settings: thermal(80, 72),
  },
  {
    id: "epson-tm-t20iii-80",
    name: "Epson TM-T20III · 80 mm",
    description:
      "Modo padrão: 72 mm úteis / 576 pontos, 203 dpi e ESC/POS. O modo de 42 colunas tem outra área útil. Drivers Windows, Mac e Linux; interfaces variam por versão.",
    sourceUrl: "https://download4.epson.biz/sec_pubs/bs/pdf/TM-T20III_trg_en_revF.pdf",
    settings: thermal(80, 72),
  },
  {
    id: "epson-tm-t20iii-58",
    name: "Epson TM-T20III · 58 mm",
    description:
      "Modo padrão de 58 mm: 52,5 mm úteis / 420 pontos. Exige ajuste físico e configuração de papel conforme o manual; este perfil só configura o documento.",
    sourceUrl: "https://download4.epson.biz/sec_pubs/bs/pdf/TM-T20III_trg_en_revF.pdf",
    settings: thermal(58, 52.5),
  },
  {
    id: "elgin-i8",
    name: "Elgin i8 · 80 mm",
    description:
      "Papel 79,5 ± 0,5 mm, 203 dpi, ESC/POS, USB/serial/Ethernet. 72 mm úteis é sugestão conservadora a calibrar; o manual consultado não explicita essa medida. Folheto lista Windows, Linux e Mac.",
    sourceUrl:
      "https://content.elgin.com.br/assets/arquivos/portal-apoio-novo/851a67d0-16de-4629-890e-e014bec90e00.pdf",
    settings: thermal(80, 72),
  },
  {
    id: "elgin-i9",
    name: "Elgin i9 Full · 80 mm",
    description:
      "203 dpi, área útil máxima de 72 mm / 576 pontos e ESC/POS. Drivers Windows/Linux no repositório oficial. Confirme a variante i9, i9 Full ou Full 2 e seu sistema operacional.",
    sourceUrl: "https://github.com/ElginDeveloperCommunity/Impressoras",
    settings: thermal(80, 72),
  },
  {
    id: "bematech-mp4200-th",
    name: "Bematech MP-4200 TH · 80 mm",
    description:
      "203 dpi. ESC/Bema e ESC/POS são modos diferentes: no manual, ESC/POS usa 80/73,5 mm; este perfil conserva 72 mm úteis. Não altera o modo da impressora. Drivers Windows/Linux; confirme firmware.",
    sourceUrl:
      "https://logiccontrols.com/wp-content/uploads/2024/03/LC2020_MP4200TH_english_user-manual.pdf",
    settings: thermal(80, 72),
  },
  {
    id: "xprinter-xp58iik",
    name: "Xprinter XP-58IIK · 58 mm",
    description:
      "Papel 57,5 ± 0,5 mm, 48 mm úteis / 384 pontos, ESC/POS. 8 pontos/mm equivalem aproximadamente a 203 dpi. Existem variantes USB, serial, Bluetooth e Wi-Fi; confirme a sua.",
    sourceUrl: "https://www.xprintertech.com/xp-58iik",
    settings: thermal(58, 48),
  },
  {
    id: "xprinter-xpq80k",
    name: "Xprinter XP-Q80K · 80 mm",
    description:
      "72 mm úteis e ESC/POS; ficha lista variantes de 576/512 pontos. 203 dpi é ponto de partida para a versão de 576 pontos. Bluetooth opcional; confirme resolução e interface antes de enviar comandos.",
    sourceUrl: "https://www.xprintertech.com/xp-q80k-1",
    settings: thermal(80, 72),
  },
  {
    id: "custom",
    name: "Personalizado",
    description:
      "Configure a largura do papel, área útil, margens e resolução conforme o manual e uma página de teste. Corte automático permanece desativado inicialmente.",
    sourceUrl: "https://developer.mozilla.org/en-US/docs/Web/CSS/@page/size",
    settings: thermal(80, 72),
  },
]

export function presetProfile(
  modelId: string,
  profileId: string,
  name?: string,
): PrinterProfile {
  const model = printerModels.find((entry) => entry.id === modelId)
  if (!model) throw new Error("Modelo de impressora desconhecido.")
  return { ...model.settings, id: profileId, modelId, name: name?.trim() || model.name }
}
