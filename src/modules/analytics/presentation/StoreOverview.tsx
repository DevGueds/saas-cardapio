import { memo, useMemo } from "react"
import { ArrowUpRight, BookOpen, Check, Clock3, ShoppingBag, Store } from "lucide-react"
import { Link } from "react-router"
import { can } from "@cardapio/domain/permissions"
import { useAccount } from "../../identity/presentation/AccountContext"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"

function StoreOverview() {
  const { menu } = useMenu(),
    { mode } = useServices(),
    account = useAccount()
  const canManage = !account || can(account.restaurant.role, "catalog:write")
  const query = mode === "api" ? `?restaurant=${menu.restaurant.id}` : ""
  const available = useMemo(
    () => menu.products.reduce((count, product) => count + Number(product.available), 0),
    [menu.products],
  )
  return (
    <section className="store-overview" aria-label="Visão geral da loja">
      <div className="store-overview__welcome">
        <span className="overview-label">
          <Store size={16} aria-hidden="true" /> Seu negócio, em movimento
        </span>
        <h2>
          Vamos cuidar da
          <br />
          <span>{menu.restaurant.name}?</span>
        </h2>
        <p>
          {menu.restaurant.isOpen
            ? "Sua loja está aberta. Acompanhe os pedidos e prepare o próximo favorito dos seus clientes."
            : "Tudo no seu tempo. Organize o cardápio e deixe a loja pronta para receber os próximos pedidos."}
        </p>
        <Link className="overview-action" to={`/admin/orders${query}`}>
          Acompanhar pedidos <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
        <span
          className={`overview-store-status ${menu.restaurant.isOpen ? "is-open" : ""}`}
        >
          <span aria-hidden="true" />
          {menu.restaurant.isOpen ? "Recebendo pedidos" : "Pedidos pausados"}
        </span>
      </div>
      <div className="store-overview__catalog">
        <span className="overview-icon">
          <BookOpen size={23} aria-hidden="true" />
        </span>
        <div>
          <span>Seu cardápio</span>
          <strong>
            {menu.products.length}
            <small>produtos</small>
          </strong>
        </div>
        <p>
          <Check size={16} aria-hidden="true" /> {available} disponíveis para pedir
        </p>
        <Link to={`/admin/menu${query}`}>
          Organizar produtos <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </div>
      {canManage && (
        <Link className="store-overview__hours" to={`/admin/hours${query}`}>
          <Clock3 size={22} aria-hidden="true" />
          <div>
            <strong>Seu horário, organizado</strong>
            <span>Revise os dias e horários de atendimento.</span>
          </div>
          <ArrowUpRight size={20} aria-hidden="true" />
        </Link>
      )}
      <Link
        className="store-overview__preview"
        to={`/menu/${menu.restaurant.slug}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ShoppingBag size={22} aria-hidden="true" />
        <div>
          <strong>Do jeito que o cliente vê</strong>
          <span>
            Abra seu cardápio digital.<span className="sr-only"> Abre em nova aba.</span>
          </span>
        </div>
        <ArrowUpRight size={20} aria-hidden="true" />
      </Link>
    </section>
  )
}
export default memo(StoreOverview)
