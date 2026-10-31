import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"
import FeatureBoundary from "../../../shared/presentation/FeatureBoundary"
import PublicOffers from "../../commerce/presentation/PublicOffers"
import RecentOrders from "../../checkout/presentation/RecentOrders"
import { useSearchParams } from "react-router"
import { useResource } from "../../../shared/presentation/use-resource"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import { discoverProducts, type DiscoveryFilter } from "../application/menu-discovery"
import { promotionActive } from "@cardapio/domain/quote"
import { useServices } from "../../../app/presentation/ServicesProvider"
import PublicProductCard from "./PublicProductCard"
import StoreInformation from "./StoreInformation"
import { categoryAnchor, useCategoryNavigation } from "./use-category-navigation"
import AddonChoice from "../../commerce/presentation/AddonChoice"
import { defaultAppearance } from "@cardapio/domain/menu-options"
import { notifySuccess } from "../../../shared/presentation/notify"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Link } from "react-router"
import {
  ArrowUpRight,
  Bike,
  ChevronRight,
  Clock3,
  Flame,
  TicketPercent,
  ArrowDownWideNarrow,
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

import CheckoutDrawer from "../../checkout/presentation/CheckoutDrawer"
import Brand from "../../../shared/presentation/Brand"
import LegalLinks from "../../../shared/presentation/legal/LegalLinks"

import { useCart } from "../../checkout/presentation/use-cart"

export default function PublicMenuPage() {
  const { menu, loading, error: loadError } = useMenu()
  const { mode, analytics } = useServices()

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

  const [discovery, setDiscovery] = useState<DiscoveryFilter>("NONE")
  const [now, setNow] = useState(Date.now)
  const loadRanking = useCallback(
    () =>
      analytics
        ? analytics.bestSellers(store.slug)
        : Promise.resolve({ ok: true as const, value: null }),
    [analytics, store.slug],
  )
  const ranking = useResource(loadRanking)
  const reloadRanking = ranking.reload
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
      if (analytics && document.visibilityState === "visible") void reloadRanking()
    }, 60000)
    return () => window.clearInterval(timer)
  }, [analytics, reloadRanking])

  const displayCategories = useMemo(
    () =>
      categories.filter((category) =>
        products.some((product) => product.categoryId === category.id),
      ),
    [categories, products],
  )

  const grouped = discovery === "NONE" && !search.trim()
  const categoryNavigation = useCategoryNavigation(
    displayCategories.map((category) => category.id),
    grouped,
  )

  const visibleProducts = useMemo(
    () =>
      discoverProducts(
        menu,
        "$all",
        search,
        discovery,
        ranking.data?.productIds ?? [],
        now,
      ),
    [menu, search, discovery, ranking.data, now],
  )
  const hasPromotions =
    menu.commerce?.promotions.some((p) => promotionActive(p, now)) ?? false
  const hasCombos = menu.commerce?.combos.some((c) => c.active) ?? false
  function chooseFilter(filter: DiscoveryFilter) {
    setDiscovery(filter)
  }
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
    setSearch("")
    setDiscovery("NONE")
    const anchor = id === "$all" ? "cardapio" : categoryAnchor(id)
    window.history.replaceState(window.history.state, "", "#" + anchor)
    window.requestAnimationFrame(() =>
      document.getElementById(anchor)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      }),
    )
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
        <StoreInformation store={store} now={now} />
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
            <div
              className="discovery-filters"
              role="group"
              aria-label="Filtros rápidos do cardápio"
            >
              <button
                type="button"
                className={`discovery-filter discovery-filter--best ${discovery === "BEST_SELLERS" ? "is-active" : ""}`}
                aria-pressed={discovery === "BEST_SELLERS"}
                onClick={() => chooseFilter("BEST_SELLERS")}
              >
                <Flame size={19} aria-hidden="true" />
                Mais vendidos<span aria-hidden="true">Top da casa</span>
              </button>
              <button
                type="button"
                className={`discovery-filter ${discovery === "PROMOTIONS" ? "is-active" : ""}`}
                aria-pressed={discovery === "PROMOTIONS"}
                onClick={() => chooseFilter("PROMOTIONS")}
              >
                <TicketPercent size={18} aria-hidden="true" />
                Promoções
              </button>
              <button
                type="button"
                className={`discovery-filter ${discovery === "CHEAPEST" ? "is-active" : ""}`}
                aria-pressed={discovery === "CHEAPEST"}
                onClick={() => chooseFilter("CHEAPEST")}
              >
                <ArrowDownWideNarrow size={18} aria-hidden="true" />
                Menores preços
              </button>
              {discovery !== "NONE" && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => chooseFilter("NONE")}
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
          <nav
            ref={categoryNavigation.navigation}
            className="category-nav"
            aria-label="Categorias do cardápio"
          >
            <a
              href="#cardapio"
              onClick={(event) => {
                event.preventDefault()
                selectCategory("$all")
              }}
            >
              Todos
            </a>
            {displayCategories.map((category) => (
              <a
                href={`#${categoryAnchor(category.id)}`}
                className={
                  categoryNavigation.active === category.id && grouped ? "is-active" : ""
                }
                aria-current={
                  categoryNavigation.active === category.id && grouped
                    ? "location"
                    : undefined
                }
                key={category.id}
                onClick={(event) => {
                  event.preventDefault()
                  selectCategory(category.id)
                }}
              >
                {category.name}
              </a>
            ))}
          </nav>
          {(discovery === "NONE" || discovery === "PROMOTIONS") && (
            <PublicOffers
              controller={controller}
              disabled={loading || !!loadError}
              search={search}
            />
          )}
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
                  {discovery === "BEST_SELLERS"
                    ? "Mais vendidos"
                    : discovery === "CHEAPEST"
                      ? "Do menor para o maior preço"
                      : discovery === "PROMOTIONS"
                        ? "Promoções e ofertas"
                        : search
                          ? `Resultados para “${search}”`
                          : "Cardápio"}
                </h2>
              </div>
              <p>
                {visibleProducts.length}{" "}
                {visibleProducts.length === 1 ? "opção" : "opções"}
              </p>
            </div>
            {discovery === "BEST_SELLERS" && (
              <p className="discovery-explanation">
                Produtos mais comprados em pedidos concluídos nos últimos 30 dias.
              </p>
            )}
            {discovery === "BEST_SELLERS" && ranking.loading && (
              <p role="status">Consultando os mais vendidos…</p>
            )}
            {discovery === "BEST_SELLERS" && ranking.error && (
              <ErrorNotice error={ranking.error} onRetry={() => void ranking.reload()} />
            )}
            {discovery === "PROMOTIONS" && hasPromotions && (
              <p className="discovery-explanation">
                Os cupons são aplicados no carrinho conforme as condições acima.
              </p>
            )}
            {visibleProducts.length ? (
              (grouped
                ? displayCategories.map((category) => ({
                    ...category,
                    products: visibleProducts.filter(
                      (product) => product.categoryId === category.id,
                    ),
                  }))
                : [{ id: "$results", name: "", products: visibleProducts }]
              ).map((category) => (
                <section
                  className="menu-category"
                  key={category.id}
                  id={grouped ? categoryAnchor(category.id) : undefined}
                  aria-labelledby={
                    grouped ? `title-${categoryAnchor(category.id)}` : undefined
                  }
                >
                  {grouped && (
                    <div className="section-heading">
                      <h3 id={`title-${categoryAnchor(category.id)}`}>{category.name}</h3>
                      <span>
                        {category.products.length}{" "}
                        {category.products.length === 1 ? "item" : "itens"}
                      </span>
                    </div>
                  )}
                  <div className="product-grid">
                    {category.products.map((product) => (
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
                </section>
              ))
            ) : discovery === "BEST_SELLERS" &&
              (ranking.loading || ranking.error) ? null : (
              <div className="empty-search">
                <Search size={28} aria-hidden="true" />
                <h3>
                  {discovery === "BEST_SELLERS"
                    ? "Ainda não há produtos neste ranking"
                    : discovery === "PROMOTIONS"
                      ? hasCombos
                        ? "Confira os combos acima"
                        : "Nenhuma promoção ativa no momento"
                      : "Nenhum item encontrado"}
                </h3>
                <p>
                  {discovery === "BEST_SELLERS"
                    ? mode === "demo"
                      ? "A demonstração não registra vendas reais. Explore as categorias da loja."
                      : "O ranking aparece quando há pedidos concluídos no período e produtos disponíveis para sua seleção."
                    : "Explore outras categorias ou tente outro nome ou ingrediente."}
                </p>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setSearch("")
                    chooseFilter("NONE")
                  }}
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
            onAdd={(addons, quantity) => {
              controller.addProduct(selectedProduct, addons, quantity)
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
