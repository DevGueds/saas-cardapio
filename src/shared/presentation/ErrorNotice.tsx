import type { AppError } from "../application/result"

const fieldLabels: Readonly<Record<string, string>> = {
  name: "Nome",
  email: "E-mail",
  password: "Senha",
  currentPassword: "Senha atual",
  newPassword: "Nova senha",
  restaurantName: "Nome da loja",
  slug: "Endereço do cardápio",
  price: "Preço",
  categoryId: "Categoria",
  categoryName: "Nova categoria",
  description: "Descrição",

  imageUrl: "Imagem",
  logoUrl: "Logo",
  coverUrl: "Capa",
  whatsapp: "WhatsApp da loja",
  phone: "Telefone",

  address: "Endereço",
  notes: "Observações",
  note: "Observação do item",
  cashChange: "Troco",
  payment: "Pagamento",

  minOrder: "Pedido mínimo",
  deliveryFee: "Taxa de entrega",
  eta: "Prazo de entrega",
}

export default function ErrorNotice({
  error,
  onRetry,
}: {
  error: AppError
  onRetry?: () => void
}) {
  const entries = Object.entries(error.fields)

  const primaryField = entries.find(([, message]) => message === error.message)?.[0]

  const otherFields = entries.filter(([, message]) => message !== error.message)

  return (
    <div className="error-notice" role="alert">
      <strong>
        {primaryField && fieldLabels[primaryField]
          ? `${fieldLabels[primaryField]}: `
          : ""}
        {error.message}
      </strong>
      {otherFields.length > 0 && (
        <ul>
          {otherFields.map(([field, message]) => (
            <li key={field}>
              {fieldLabels[field] ? `${fieldLabels[field]}: ` : ""}
              {message}
            </li>
          ))}
        </ul>
      )}
      <small>
        Referência: {error.diagnosticId} · {error.code}
      </small>
      {onRetry && (
        <button type="button" className="secondary-button" onClick={onRetry}>
          Atualizar dados e tentar novamente
        </button>
      )}
    </div>
  )
}
