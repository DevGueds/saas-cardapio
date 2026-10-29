import Dialog from "../../../shared/presentation/Dialog"

export default function PrintingHelpDialog({ onClose }: { onClose(): void }) {
  return (
    <Dialog title="Ajuda com impressão" onClose={onClose}>
      <div className="printing-help">
        <details open>
          <summary>Minha impressora é Bluetooth</summary>
          <p>
            Pareie a impressora no dispositivo e instale o driver ou aplicativo do
            fabricante. Depois, use “Testar impressão”. Se não souber o modelo, escolha
            Térmica / Bluetooth 58 ou 80 mm, conforme a bobina.
          </p>
          <p>
            No Android, pode ser necessário um serviço de impressão. No iPhone/iPad, a
            impressão depende de AirPrint ou do aplicativo do fabricante; Bluetooth
            genérico pode não ser compatível.
          </p>
        </details>
        <details>
          <summary>A impressora não aparece</summary>
          <p>
            A lista de impressoras pertence ao sistema do dispositivo. Confira o
            pareamento e o driver. Você também pode baixar o PDF e abri-lo no aplicativo
            do fabricante.
          </p>
        </details>
        <details>
          <summary>O texto está cortado ou pequeno</summary>
          <p>
            Confira o papel no modelo da impressora. No diálogo do sistema, use escala de
            100%, sem cabeçalhos ou rodapés. Os ajustes de largura útil, margem e letra
            ficam em “Ajustar impressora”. Os modelos são pontos de partida; confira uma
            impressão de teste.
          </p>
        </details>
        <details>
          <summary>O que significa “não fiscal”?</summary>
          <p>
            Os documentos usam os registros da loja. Não substituem nota ou cupom fiscal.
            Gerar ou imprimir não registra pagamento, não confirma pagamento bancário e
            não confirma entrega.
          </p>
        </details>
      </div>
    </Dialog>
  )
}
