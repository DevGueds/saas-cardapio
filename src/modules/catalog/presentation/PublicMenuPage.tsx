import PublicProductCard from "./PublicProductCard"
import { useMemo, useState } from "react"

import { useNavigate } from "react-router"

import {
  ChevronRight,
  Clock3,
  MapPin,
  Menu,
  Search,
  ShoppingBag,
  Store,
  X,
} from "lucide-react"

import { useMenu } from "../../../app/presentation/MenuScope"

import { formatMoney } from "../../../shared/domain/money"

import { normalizeName } from "../../../shared/domain/validation"

import CheckoutDrawer from "../../checkout/presentation/CheckoutDrawer"

import { useCart } from "../../checkout/presentation/use-cart"

export default function PublicMenuPage() {
  const navigate = useNavigate()

  const { menu, loading, error: loadError } = useMenu()

  const { restaurant: store, categories, products } = menu

  const controller = useCart(store.id, products)

  const { subtotal, itemCount } = controller

  const [cartOpen, setCartOpen] = useState(false)

  const [search, setSearch] = useState("")

  const [selection, setSelection] = useState("$popular")

  const displayCategories = useMemo(
    () =>
      products.some((product) => product.popular)
        ? [{ id: "$popular", name: "Mais vendidos" }, ...categories]
        : categories,
    [categories, products],
  )

  const activeCategory = displayCategories.some((category) => category.id === selection)
    ? selection
    : displayCategories[0]?.id

  const visibleProducts = products.filter((product) =>
    search.trim()
      ? normalizeName(`${product.name} ${product.description}`).includes(
          normalizeName(search),
        )
      : activeCategory === "$popular"
        ? product.popular
        : product.categoryId === activeCategory,
  )

  function selectCategory(id: string) {
    setSelection(id)
    setSearch("")

    document
      .getElementById("cardapio")
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <img className="hero__image" src={store.coverUrl || undefined} alt="" />
        <div className="hero__shade" />
        <div className="hero__topbar">
          <button
            className="icon-button icon-button--glass"
            type="button"
            aria-label="Acessar painel administrativo"
            onClick={() => navigate("/admin")}
          >
            <Menu size={20} strokeWidth={2.2} />
          </button>
          <span className="demo-badge">Cardápio demo · dados locais</span>
          <button
            className="icon-button icon-button--glass cart-shortcut"
            type="button"
            aria-label={`Abrir carrinho com ${itemCount} ${
              itemCount === 1 ? "item" : "itens"
            }`}
            onClick={() => setCartOpen(true)}
          >
            <ShoppingBag size={20} strokeWidth={2.2} />
            {itemCount > 0 && <span className="cart-shortcut__count">{itemCount}</span>}
          </button>
        </div>
      </header>

      <main>
        <section className="store-card" aria-labelledby="store-name">
          <img
            className="store-card__logo"
            src={store.logoUrl || undefined}
            alt={`Logo ${store.name}`}
          />
          <div className="store-card__heading">
            <div>
              <h1 id="store-name">{store.name}</h1>
              <p>{store.description}</p>
            </div>
            <div className={`status ${store.isOpen ? "status--open" : "status--closed"}`}>
              <span />
              {store.isOpen ? "Aberto" : "Fechado"}
            </div>
          </div>
          <div className="store-meta">
            <span>
              <Clock3 size={17} />
              {store.eta} · Taxa {formatMoney(store.deliveryFee)}
            </span>
            <span>
              <MapPin size={17} />
              Pedido mínimo {formatMoney(store.minOrder)}
            </span>
          </div>
        </section>

        {/* Store Closed Banner Notice */}
        {!store.isOpen && (
          <div className="store-closed-banner" role="alert">
            <Clock3 size={20} />
            <div>
              <strong>Loja fechada no momento</strong>
              <p>
                Estamos fora do horário de atendimento. Você pode consultar o cardápio,
                mas pedidos estão temporariamente pausados.
              </p>
            </div>
          </div>
        )}

        <div className="content">
          <div className="search-box">
            <Search size={20} aria-hidden="true" />
            <input
              aria-label="Buscar no cardápio"
              type="search"
              placeholder="O que você está procurando?"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setSearch("")}
              >
                <X size={18} />
              </button>
            )}
          </div>

          <nav className="category-nav" aria-label="Categorias do cardápio">
            {displayCategories.map((category) => (
              <button
                className={activeCategory === category.id && !search ? "is-active" : ""}
                type="button"
                key={category.id}
                onClick={() => selectCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </nav>

          <section
            className="menu-section"
            id="cardapio"
            aria-labelledby="category-title"
          >
            <div className="section-heading">
              <div>
                <span>Cardápio</span>
                <h2 id="category-title">
                  {search
                    ? `Resultados para “${search}”`
                    : displayCategories.find((category) => category.id === activeCategory)
                        ?.name || "Cardápio"}
                </h2>
              </div>
              <p>{visibleProducts.length} itens</p>
            </div>

            {visibleProducts.length ? (
              <div className="product-grid">
                {visibleProducts.map((product) => (
                  <PublicProductCard
                    key={product.id}
                    product={product}
                    quantity={controller.quantity(product.id)}
                    disabled={loading || !!loadError}
                    onQuantityChange={(delta) =>
                      controller.updateQuantity(product.id, delta)
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="empty-search">
                <Search size={28} />
                <h3>Nenhum item encontrado</h3>
                <p>Tente buscar por outro nome ou ingrediente.</p>
                <button type="button" onClick={() => setSearch("")}>
                  Ver cardápio completo
                </button>
              </div>
            )}
          </section>
        </div>
      </main>

      {itemCount > 0 && !cartOpen && (
        <div className="floating-cart-wrap">
          <button
            className="floating-cart"
            type="button"
            onClick={() => setCartOpen(true)}
          >
            <span className="floating-cart__count">{itemCount}</span>
            <span>
              Ver carrinho
              <small>{itemCount === 1 ? "1 item" : `${itemCount} itens`}</small>
            </span>
            <strong>{formatMoney(subtotal)}</strong>
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {cartOpen && (
        <CheckoutDrawer controller={controller} onClose={() => setCartOpen(false)} />
      )}
      <footer>
        <Store size={16} /> Cardápio digital · {store.name}
      </footer>
    </div>
  )
}
