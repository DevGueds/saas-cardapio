import { useMemo, useState } from "react"
import {
  BarChart3,
  Bell,
  CheckCircle2,
  ChefHat,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  LayoutDashboard,
  Menu,
  MessageCircle,
  MoreHorizontal,
  PackageCheck,
  Printer,
  Settings,
  ShoppingBag,
  Store,
  Truck,
  UtensilsCrossed,
  Volume2,
  X,
} from "lucide-react"
import { useNavigate } from "react-router"
import MenuManagement from "./MenuManagement"

type OrderStatus = "new" | "preparing" | "delivery"
type PaymentStatus = "confirmed" | "pending"

type Order = {
  id: string
  time: string
  customer: string
  phone: string
  items: string[]
  total: number
  paymentMethod: string
  paymentStatus: PaymentStatus
  status: OrderStatus
}

const initialOrders: Order[] = [
  {
    id: "1048",
    time: "há 2 min",
    customer: "Mariana Costa",
    phone: "11 99842-5521",
    items: ["2x Smash Clássico", "1x Fritas com cheddar", "2x Coca-Cola Zero"],
    total: 82.8,
    paymentMethod: "Pix",
    paymentStatus: "confirmed",
    status: "new",
  },
  {
    id: "1047",
    time: "há 7 min",
    customer: "Rafael Lima",
    phone: "11 97651-8034",
    items: ["1x Brasa Bacon", "1x Onion Rings", "1x Guaraná"],
    total: 62.8,
    paymentMethod: "Dinheiro",
    paymentStatus: "pending",
    status: "new",
  },
  {
    id: "1046",
    time: "há 14 min",
    customer: "Camila Rocha",
    phone: "11 98801-2240",
    items: ["2x Combo da Casa", "1x Fritas pequena"],
    total: 108.7,
    paymentMethod: "Cartão",
    paymentStatus: "pending",
    status: "new",
  },
  {
    id: "1045",
    time: "há 21 min",
    customer: "Paulo Mendes",
    phone: "11 96442-1188",
    items: ["1x Double Smash", "1x Coca-Cola"],
    total: 46.9,
    paymentMethod: "Pix",
    paymentStatus: "confirmed",
    status: "preparing",
  },
  {
    id: "1044",
    time: "há 28 min",
    customer: "Bianca Alves",
    phone: "11 99771-3045",
    items: ["2x Brasa Salad", "2x Suco de laranja"],
    total: 83.8,
    paymentMethod: "Pix",
    paymentStatus: "confirmed",
    status: "preparing",
  },
  {
    id: "1043",
    time: "há 43 min",
    customer: "Lucas Freire",
    phone: "11 95512-7780",
    items: ["1x Combo da Casa", "1x Milk-shake"],
    total: 62.9,
    paymentMethod: "Cartão",
    paymentStatus: "confirmed",
    status: "delivery",
  },
]

const columns: {
  id: OrderStatus
  title: string
  eyebrow: string
  icon: typeof Clock3
}[] = [
  { id: "new", title: "Pendentes / Novos", eyebrow: "1", icon: Clock3 },
  { id: "preparing", title: "Em Preparo", eyebrow: "2", icon: ChefHat },
  {
    id: "delivery",
    title: "Saiu para Entrega / Concluídos",
    eyebrow: "3",
    icon: Truck,
  },
]

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<"orders" | "menu">(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname.toLowerCase()
      if (path.includes("order") || path.includes("pedidos")) return "orders"
      return "menu"
    }
    return "menu"
  })
  const [orders, setOrders] = useState(initialOrders)
  const [storeOpen, setStoreOpen] = useState(true)
  const [soundOn, setSoundOn] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const newOrders = orders.filter((order) => order.status === "new").length
  const revenue = useMemo(
    () => orders.reduce((sum, order) => sum + order.total, 0),
    [orders],
  )

  const advanceOrder = (id: string) => {
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== id) return order
        if (order.status === "new") return { ...order, status: "preparing" }
        if (order.status === "preparing")
          return { ...order, status: "delivery" }
        return order
      }),
    )
  }

  const notifyCustomer = (order: Order) => {
    const message =
      order.status === "delivery"
        ? `Olá, ${order.customer}! Seu pedido #${order.id} saiu para entrega.`
        : `Olá, ${order.customer}! Seu pedido #${order.id} está sendo preparado com carinho.`
    window.open(
      `https://wa.me/55${order.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener",
    )
  }

  return (
    <div className="admin-shell">
      <button
        className={`admin-sidebar-backdrop ${sidebarOpen ? "is-visible" : ""}`}
        type="button"
        aria-label="Fechar navegação"
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`admin-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="admin-brand">
          <span>
            <UtensilsCrossed size={21} />
          </span>
          <div>
            <strong>Cardápio</strong>
            <small>WhatsApp</small>
          </div>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={19} />
          </button>
        </div>

        <div className="restaurant-switcher">
          <img
            src="https://images.unsplash.com/photo-1581574470202-7e344021b092?auto=format&fit=crop&w=120&q=80"
            alt=""
          />
          <div>
            <small>Restaurante ativo</small>
            <strong>Burger House</strong>
          </div>
          <ChevronRight size={17} />
        </div>

        <nav className="admin-nav" aria-label="Navegação principal">
          <button
            className={activeTab === "menu" ? "is-active" : ""}
            type="button"
            onClick={() => {
              setActiveTab("menu")
              setSidebarOpen(false)
            }}
          >
            <ShoppingBag size={19} />
            <span>Gestão do Cardápio</span>
            <small>13 itens</small>
          </button>
          <button
            className={activeTab === "orders" ? "is-active" : ""}
            type="button"
            onClick={() => {
              setActiveTab("orders")
              setSidebarOpen(false)
            }}
          >
            <LayoutDashboard size={19} />
            <span>Pedidos em Tempo Real</span>
            <small>{newOrders} novos</small>
          </button>
          <button
            type="button"
            onClick={() => {
              window.open("/", "_blank")
            }}
          >
            <Store size={19} />
            <span>Cardápio dos Clientes</span>
          </button>
          <button type="button">
            <BarChart3 size={19} />
            <span>Faturamento</span>
          </button>
          <button type="button">
            <Settings size={19} />
            <span>Configurações</span>
          </button>
        </nav>

        <div className="admin-plan">
          <CircleDollarSign size={19} />
          <div>
            <strong>Plano Pro</strong>
            <small>Todos os recursos ativos</small>
          </div>
          <CheckCircle2 size={16} />
        </div>

        <div className="admin-profile">
          <span>GS</span>
          <div>
            <strong>Gabriel Silva</strong>
            <small>Administrador</small>
          </div>
          <MoreHorizontal size={18} />
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="admin-mobile-title">
            <button
              type="button"
              aria-label="Abrir menu"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={21} />
            </button>
            <strong>
              {activeTab === "menu" ? "Gestão do Cardápio" : "Pedidos"}
            </strong>
          </div>
          <div className="admin-topbar__status">
            <div className="live-indicator">
              <span />
              Atualização em tempo real
            </div>
            <button
              className={`sound-control ${soundOn ? "is-on" : ""}`}
              type="button"
              onClick={() => setSoundOn((current) => !current)}
            >
              <Volume2 size={18} />
              <span>Som {soundOn ? "ativo" : "desativado"}</span>
            </button>
            <button
              className="notification-button"
              type="button"
              aria-label="Notificações"
            >
              <Bell size={19} />
              <span />
            </button>
            <div className="store-control">
              <div>
                <small>Status da loja</small>
                <strong>{storeOpen ? "Loja aberta" : "Loja fechada"}</strong>
              </div>
              <button
                className={`toggle ${storeOpen ? "is-on" : ""}`}
                type="button"
                role="switch"
                aria-checked={storeOpen}
                onClick={() => setStoreOpen((current) => !current)}
              >
                <span />
              </button>
            </div>
          </div>
        </header>

        <main className="admin-main">
          {activeTab === "menu" ? (
            <MenuManagement />
          ) : (
            <>
              <div className="admin-page-heading">
                <div>
                  <p>Quarta-feira, 24 de junho</p>
                  <h1>Gestor de Pedidos</h1>
                  <span>Acompanhe e atualize seus pedidos em tempo real.</span>
                </div>
                <div className="admin-metrics">
                  <div>
                    <PackageCheck size={18} />
                    <span>
                      <small>Pedidos hoje</small>
                      <strong>48</strong>
                    </span>
                  </div>
                  <div>
                    <CreditCard size={18} />
                    <span>
                      <small>Em andamento</small>
                      <strong>
                        {
                          orders.filter((order) => order.status !== "delivery")
                            .length
                        }
                      </strong>
                    </span>
                  </div>
                  <div>
                    <CircleDollarSign size={18} />
                    <span>
                      <small>Total no quadro</small>
                      <strong>{money.format(revenue)}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <section className="kanban-board" aria-label="Quadro de pedidos">
                {columns.map((column) => {
                  const Icon = column.icon
                  const columnOrders = orders.filter(
                    (order) => order.status === column.id,
                  )
                  return (
                    <div
                      className={`kanban-column kanban-column--${column.id}`}
                      key={column.id}
                    >
                      <div className="kanban-column__heading">
                        <div>
                          <span className="column-icon">
                            <Icon size={17} />
                          </span>
                          <span>
                            <small>ETAPA {column.eyebrow}</small>
                            <strong>{column.title}</strong>
                          </span>
                        </div>
                        <em>{columnOrders.length}</em>
                      </div>

                      <div className="kanban-list">
                        {columnOrders.map((order) => (
                          <article className="order-card" key={order.id}>
                            <div className="order-card__top">
                              <div>
                                <span>Pedido</span>
                                <strong>#{order.id}</strong>
                              </div>
                              <time>
                                <Clock3 size={13} />
                                {order.time}
                              </time>
                            </div>
                            <div className="order-customer">
                              <span>{order.customer.charAt(0)}</span>
                              <div>
                                <strong>{order.customer}</strong>
                                <button
                                  type="button"
                                  onClick={() => notifyCustomer(order)}
                                >
                                  <MessageCircle size={12} />
                                  {order.phone}
                                </button>
                              </div>
                            </div>
                            <ul>
                              {order.items.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                            <div className="order-payment">
                              <div>
                                <span>Total</span>
                                <strong>{money.format(order.total)}</strong>
                              </div>
                              <span
                                className={`payment-pill payment-pill--${order.paymentStatus}`}
                              >
                                {order.paymentStatus === "confirmed"
                                  ? `${order.paymentMethod} Confirmado`
                                  : `${order.paymentMethod} · Pendente`}
                              </span>
                            </div>
                            <div className="order-actions">
                              <button
                                type="button"
                                onClick={() => window.print()}
                              >
                                <Printer size={15} />
                                Imprimir
                              </button>
                              {order.status !== "delivery" ? (
                                <button
                                  className="order-actions__primary"
                                  type="button"
                                  onClick={() => advanceOrder(order.id)}
                                >
                                  Avançar Status
                                  <ChevronRight size={15} />
                                </button>
                              ) : (
                                <button
                                  className="order-actions__primary"
                                  type="button"
                                  onClick={() => notifyCustomer(order)}
                                >
                                  <MessageCircle size={15} />
                                  Avisar no WhatsApp
                                </button>
                              )}
                            </div>
                          </article>
                        ))}
                        {columnOrders.length === 0 && (
                          <div className="kanban-empty">
                            <CheckCircle2 size={24} />
                            <span>Nenhum pedido nesta etapa</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
