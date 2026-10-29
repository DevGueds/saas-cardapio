import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"
import FeatureBoundary from "../../../shared/presentation/FeatureBoundary"
import PublicOffers from "../../commerce/presentation/PublicOffers"
import RecentOrders from "../../checkout/presentation/RecentOrders"
import { useSearchParams } from "react-router"
import { useServices } from "../../../app/presentation/ServicesProvider"
import PublicProductCard from "./PublicProductCard"
import AddonChoice from "../../commerce/presentation/AddonChoice"
import { defaultAppearance } from "@cardapio/domain/menu-options"
import { notifySuccess } from "../../../shared/presentation/notify"
import { useEffect, useMemo, useState } from "react"

import { Link } from "react-router"
import {
  ArrowUpRight,
  Bike,
  ChevronRight,
  Clock3,
  Flame,
  MapPin,
  MessageCircle,
  Search,
  ShoppingBag,
  UtensilsCrossed,
  X,
} from "lucide-react"
import ImageWithFallback from "../../../shared/presentation/ImageWithFallback"

import { useMenu } from "../../../app/presentation/MenuScope"

import { formatMoney } from "../../../shared/domain/money"

import { normalizeName } from "../../../shared/domain/validation"

import CheckoutDrawer from "../../checkout/presentation/CheckoutDrawer"
import Brand from "../../../shared/presentation/Brand"
import LegalLinks from "../../../shared/presentation/legal/LegalLinks"

import { useCart } from "../../checkout/presentation/use-cart"

export default function PublicMenuPage() {
  const { menu, loading, error: loadError } = useMenu()
  const { mode } = useServices()

  const { restaurant: store, categories, products } = menu
  const appearance = menu.commerce?.appearance ?? defaultAppearance()

  useEffect(() => {
    document.title = `${store.name} · Pede Aqui`
  }, [store.name])

  const controller = useCart(menu)

  const { subtotal, itemCount } = controller

  const [params, setParams] = useSearchParams()
  const cartOpen = params.get("cart") === "1"
  const setCartOpen = (open: boolean) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      if (open) next.set("cart", "1")
      else next.delete("cart")
      return next
    })

  const [search, setSearch] = useState("")
  const [customizing, setCustomizing] = useState<string | null>(null)
  const selectedProduct = products.find((p) => p.id === customizing)

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

  const visibleProducts = useMemo(
    () =>
      products.filter((product) =>
        search.trim()
          ? normalizeName(`${product.name} ${product.description}`).includes(
              normalizeName(search),
            )
          : activeCategory === "$popular"
            ? product.popular
            : product.categoryId === activeCategory,
      ),
    [products, search, activeCategory],
  )
  const customizable = useMemo(
    () =>
      new Set(
        menu.commerce?.addonGroups
          ?.filter((g) => g.active)
          .flatMap((g) => g.productIds) ?? [],
      ),
    [menu.commerce?.addonGroups],
  )

  function selectCategory(id: string) {
    setSelection(id)
    setSearch("")

    document.getElementById("cardapio")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    })
  }

  return (
    <div
      className={`app-shell menu-theme menu-theme--${appearance.preset.toLowerCase()} menu-color--${appearance.color.toLowerCase()} ${appearance.showImages ? "" : "menu-without-images"}`}
    >
      <a className="skip-link" href="#cardapio">
        Pular para o cardápio
      </a>
      <header className="public-topbar">
        <Link className="public-wordmark" to={`/menu/${store.slug}`}>
          <UtensilsCrossed size={21} aria-hidden="true" />
          <span>Cardápio digital</span>
        </Link>
        <span className="demo-badge">
          {mode === "api" ? "Peça direto com a loja" : "Cardápio demo · dados locais"}
        </span>
        <button
          className="cart-shortcut"
          type="button"
          aria-label={`Abrir carrinho com ${itemCount} ${itemCount === 1 ? "item" : "itens"}`}
          onClick={() => setCartOpen(true)}
        >
          <ShoppingBag size={20} aria-hidden="true" />
          <span>Meu carrinho</span>
          <span className="cart-shortcut__count">{itemCount}</span>
        </button>
      </header>
      <main id="public-content">
        <section className="store-hero" aria-labelledby="store-name">
          <div className="store-card">
            <div className="store-card__identity">
              <ImageWithFallback
                className="store-card__logo"
                src={store.logoUrl}
                alt={`Logo ${store.name}`}
              />
              <div
                className={`status ${store.isOpen ? "status--open" : "status--closed"}`}
              >
                <span />
                {store.isOpen ? "Aberto" : "Fechado"}
              </div>
            </div>
            <p className="store-eyebrow">{appearance.headline}</p>
            <h1 id="store-name">{store.name}</h1>
            <p className="store-description">{store.description}</p>
            <div className="store-meta">
              <span>
                <Clock3 size={18} aria-hidden="true" />
                <span>
                  <small>Tempo de entrega</small>
                  <strong>{store.eta}</strong>
                </span>
              </span>
              <span>
                <Bike size={18} aria-hidden="true" />
                <span>
                  <small>Taxa de entrega</small>
                  <strong>
                    {menu.commerce?.delivery.mode === "ZONES"
                      ? "Por bairro"
                      : menu.commerce?.delivery.mode === "RADIUS"
                        ? "Por distância"
                        : formatMoney(store.deliveryFee)}
                  </strong>
                </span>
              </span>
              <span>
                <ShoppingBag size={18} aria-hidden="true" />
                <span>
                  <small>Pedido mínimo</small>
                  <strong>{formatMoney(store.minOrder)}</strong>
                </span>
              </span>
            </div>
          </div>
          <div className="hero-media">
            <ImageWithFallback src={store.coverUrl} alt="" />
            <div className="hero-caption">
              <UtensilsCrossed size={17} aria-hidden="true" />
              <span>Escolha. Personalize. Aproveite.</span>
            </div>
          </div>
        </section>
        {!store.isOpen && (
          <div className="store-closed-banner" role="alert">
            <Clock3 size={23} aria-hidden="true" />
            <div>
              <strong>Loja fechada no momento</strong>
              <p>Você pode explorar o cardápio. Os pedidos voltam quando a loja abrir.</p>
            </div>
          </div>
        )}
        <div className="content">
          <RecentOrders restaurantId={store.id} slug={store.slug} />
          <PublicOffers
            controller={controller}
            disabled={loading || !!loadError}
            search={search}
          />
          <div className="menu-discovery">
            <div className="search-box">
              <Search size={20} aria-hidden="true" />
              <ValidatedInput
                aria-label="Buscar no cardápio"
                type="search"
                placeholder="O que você quer comer hoje?"
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
                  aria-pressed={activeCategory === category.id && !search}
                  type="button"
                  key={category.id}
                  onClick={() => selectCategory(category.id)}
                >
                  {category.id === "$popular" && <Flame size={17} aria-hidden="true" />}
                  {category.name}
                </button>
              ))}
            </nav>
          </div>
          <section
            className="menu-section"
            id="cardapio"
            aria-labelledby="category-title"
            tabIndex={-1}
          >
            <div className="section-heading">
              <div>
                <span className="eyebrow">Feito para você</span>
                <h2 id="category-title">
                  {search
                    ? `Resultados para “${search}”`
                    : displayCategories.find((category) => category.id === activeCategory)
                        ?.name || "Cardápio"}
                </h2>
              </div>
              <p>
                {visibleProducts.length}{" "}
                {visibleProducts.length === 1 ? "opção" : "opções"}
              </p>
            </div>
            {visibleProducts.length ? (
              <div className="product-grid">
                {visibleProducts.map((product) => (
                  <FeatureBoundary
                    key={product.id}
                    label={`Produto ${product.name}`}
                    resetKeys={[product]}
                  >
                    <PublicProductCard
                      product={product}
                      quantity={controller.quantity(product.id)}
                      disabled={loading || !!loadError}
                      onCustomize={
                        customizable.has(product.id) ? setCustomizing : undefined
                      }
                      onQuantityChange={controller.updateQuantity}
                    />
                  </FeatureBoundary>
                ))}
              </div>
            ) : (
              <div className="empty-search">
                <Search size={28} aria-hidden="true" />
                <h3>Nenhum item encontrado</h3>
                <p>Tente buscar por outro nome ou ingrediente.</p>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setSearch("")}
                >
                  Ver cardápio completo
                </button>
              </div>
            )}
          </section>
          <div className="menu-howto">
            <MessageCircle size={24} aria-hidden="true" />
            <div>
              <strong>Seu pedido, direto com a loja.</strong>
              <p>
                {mode === "api"
                  ? "Escolha os itens, revise seu carrinho e envie o pedido para a loja."
                  : "Escolha os itens, revise seu carrinho e envie pelo WhatsApp."}
              </p>
            </div>
          </div>
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
              Ver carrinho<small>Revise e continue seu pedido</small>
            </span>
            <strong>{formatMoney(subtotal)}</strong>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      )}
      {cartOpen && (
        <FeatureBoundary label="Carrinho">
          <CheckoutDrawer controller={controller} onClose={() => setCartOpen(false)} />
        </FeatureBoundary>
      )}
      {selectedProduct && (
        <FeatureBoundary label="Escolha de adicionais">
          <AddonChoice
            key={selectedProduct.id}
            product={selectedProduct}
            disabled={loading || !!loadError || controller.cart.lines.length >= 100}
            onClose={() => setCustomizing(null)}
            onAdd={(addons) => {
              controller.addProduct(selectedProduct, addons)
              notifySuccess(`${selectedProduct.name} adicionado ao carrinho.`)
              setCustomizing(null)
            }}
          />
        </FeatureBoundary>
      )}
      <footer className="public-footer">
        <div className="public-powered">
          <small>Seu pedido acontece com</small>
          <Brand compact />
        </div>
        <span>
          <UtensilsCrossed size={17} aria-hidden="true" />
          {store.name}
        </span>
        {store.address && (
          <span className="store-address">
            <MapPin size={15} aria-hidden="true" />
            {store.address}
          </span>
        )}
        <Link to="/admin" aria-label="Acessar painel administrativo">
          Área da loja <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </footer>
      <div className="public-legal">
        <LegalLinks />
      </div>
    </div>
  )
}
