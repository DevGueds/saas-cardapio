import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router"
import {
  AlertCircle,
  Check,
  ChevronRight,
  Clock3,
  MapPin,
  Menu,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  X,
} from "lucide-react"
import {
  Category,
  Product,
  StoreData,
  useSharedCategories,
  useSharedProducts,
  useSharedStore,
} from "./dataStore"

type Cart = Record<string, number>
type Payment = "Pix" | "Cartão na Entrega" | "Dinheiro"

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

function getSlug() {
  const cleanPath = window.location.pathname.replace(/^\/|\/$/g, "")
  return cleanPath.split("/").filter(Boolean).at(-1) || "brasa-e-pao"
}

async function fetchSupabaseMenu(slug: string) {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null

  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  const storeResponse = await fetch(
    `${url}/rest/v1/stores?slug=eq.${encodeURIComponent(slug)}&active=eq.true&select=*&limit=1`,
    { headers },
  )
  if (!storeResponse.ok) throw new Error("Não foi possível carregar a loja.")
  const [rawStore] = await storeResponse.json()
  if (!rawStore) throw new Error("Loja não encontrada.")

  const [categoryResponse, productResponse] = await Promise.all([
    fetch(
      `${url}/rest/v1/categories?store_id=eq.${rawStore.id}&active=eq.true&select=*&order=sort_order`,
      { headers },
    ),
    fetch(
      `${url}/rest/v1/products?store_id=eq.${rawStore.id}&active=eq.true&select=*&order=sort_order`,
      { headers },
    ),
  ])
  if (!categoryResponse.ok || !productResponse.ok) {
    throw new Error("Não foi possível carregar o cardápio.")
  }

  const rawCategories = await categoryResponse.json()
  const rawProducts = await productResponse.json()
  return {
    store: {
      id: rawStore.id,
      name: rawStore.name,
      description: rawStore.description ?? "",
      logoUrl: rawStore.logo_url ?? "",
      coverUrl: rawStore.cover_url ?? "",
      whatsapp: rawStore.whatsapp,
      deliveryFee: Number(rawStore.delivery_fee ?? 0),
      minOrder: Number(rawStore.min_order ?? 0),
      address: rawStore.address ?? "",
      isOpen: rawStore.is_open ?? true,
      eta: rawStore.eta ?? "30–45 min",
    } satisfies StoreData,
    categories: rawCategories.map((category: Record<string, unknown>) => ({
      id: String(category.id),
      name: String(category.name),
    })) as Category[],
    products: rawProducts.map((product: Record<string, unknown>) => ({
      id: String(product.id),
      categoryId: String(product.category_id),
      name: String(product.name),
      description: String(product.description ?? ""),
      price: Number(product.price),
      imageUrl: String(product.image_url ?? ""),
      available: Boolean(product.available ?? product.active ?? true),
      popular: Boolean(product.popular),
    })) as Product[],
  }
}

export default function PublicMenu() {
  const navigate = useNavigate()
  const [store, setStore] = useSharedStore()
  const [categories, setCategories] = useSharedCategories()
  const [products, setProducts] = useSharedProducts()
  const [cart, setCart] = useState<Cart>({ "prod-1": 1, "prod-9": 1 })
  const [cartOpen, setCartOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("popular")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [address, setAddress] = useState("")
  const [orderNotes, setOrderNotes] = useState("")
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({
    "prod-1": "Sem cebola",
  })
  const [payment, setPayment] = useState<Payment>("Pix")
  const [cashChange, setCashChange] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isDemo, setIsDemo] = useState(true)
  const navRef = useRef<HTMLDivElement>(null)

  // Dynamic category list: Include "Mais Vendidos" if any products are popular
  const displayCategories = useMemo(() => {
    const hasPopular = products.some((p) => p.popular)
    if (hasPopular) {
      return [{ id: "popular", name: "Mais Vendidos" }, ...categories]
    }
    return categories
  }, [categories, products])

  useEffect(() => {
    if (
      displayCategories.length > 0 &&
      !displayCategories.some((c) => c.id === activeCategory) &&
      activeCategory !== "popular"
    ) {
      setActiveCategory(displayCategories[0].id)
    }
  }, [displayCategories, activeCategory])

  useEffect(() => {
    fetchSupabaseMenu(getSlug())
      .then((data) => {
        if (!data) return
        setStore(data.store)
        setCategories(data.categories)
        setProducts(data.products)
        setIsDemo(false)
      })
      .catch(() => setIsDemo(true))
  }, [setStore, setCategories, setProducts])

  useEffect(() => {
    document.body.style.overflow = cartOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [cartOpen])

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCartOpen(false)
    }
    window.addEventListener("keydown", close)
    return () => window.removeEventListener("keydown", close)
  }, [])

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, quantity]) => ({
          product: products.find((product) => product.id === id),
          quantity,
        }))
        .filter(
          (item): item is { product: Product; quantity: number } =>
            Boolean(item.product) && item.quantity > 0,
        ),
    [cart, products],
  )

  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  )
  const total = subtotal + store.deliveryFee

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR")
    if (term) {
      return products.filter(
        (product) =>
          product.name.toLocaleLowerCase("pt-BR").includes(term) ||
          product.description.toLocaleLowerCase("pt-BR").includes(term),
      )
    }
    if (activeCategory === "popular") {
      return products.filter((product) => product.popular)
    }
    return products.filter((product) => product.categoryId === activeCategory)
  }, [activeCategory, products, search])

  const updateQuantity = (id: string, delta: number) => {
    const prod = products.find((p) => p.id === id)
    // Prevent adding/incrementing if product is marked as unavailable/esgotado
    if (delta > 0 && prod && prod.available === false) {
      return
    }

    setCart((current) => {
      const quantity = Math.max(0, (current[id] ?? 0) + delta)
      if (quantity === 0) {
        const next = { ...current }
        delete next[id]
        return next
      }
      return { ...current, [id]: quantity }
    })
  }

  const selectCategory = (categoryId: string) => {
    setSearch("")
    setActiveCategory(categoryId)
    document
      .getElementById("cardapio")
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const sendOrder = () => {
    const nextErrors: Record<string, string> = {}

    // Check store status
    if (!store.isOpen) {
      nextErrors.order =
        "A loja está fechada no momento e não está recebendo pedidos."
      setErrors(nextErrors)
      return
    }

    // Check unavailable items
    const unavailableInCart = cartItems.filter(
      (item) => item.product.available === false,
    )
    if (unavailableInCart.length > 0) {
      nextErrors.order = `O item "${unavailableInCart[0].product.name}" está esgotado no momento. Remova-o do carrinho para continuar.`
      setErrors(nextErrors)
      return
    }

    if (!customerName.trim()) nextErrors.name = "Informe seu nome."
    if (customerPhone.replace(/\D/g, "").length < 10) {
      nextErrors.phone = "Informe um WhatsApp válido."
    }
    if (!address.trim()) nextErrors.address = "Informe o endereço completo."
    if (subtotal < store.minOrder) {
      nextErrors.order = `O pedido mínimo é ${currency.format(store.minOrder)}.`
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const lines = cartItems
      .map(({ product, quantity }) => {
        const note = itemNotes[product.id]?.trim()
        return `${quantity}x *${product.name}* — ${currency.format(product.price * quantity)}${
          note ? `\n  _Obs.: ${note}_` : ""
        }`
      })
      .join("\n")
    const message = [
      `*NOVO PEDIDO — ${store.name.toUpperCase()}*`,
      "",
      "*Itens do pedido:*",
      lines,
      "",
      `Subtotal: ${currency.format(subtotal)}`,
      `Taxa de entrega: ${currency.format(store.deliveryFee)}`,
      `*TOTAL: ${currency.format(total)}*`,
      "",
      "*Dados para entrega:*",
      `Nome: ${customerName.trim()}`,
      `WhatsApp: ${customerPhone.trim()}`,
      `Endereço: ${address.trim()}`,
      `Pagamento: ${payment}`,
      ...(payment === "Dinheiro" && cashChange
        ? [`Troco para: ${cashChange}`]
        : []),
      ...(orderNotes.trim() ? [`Observações: ${orderNotes.trim()}`] : []),
      "",
      "Pedido enviado pelo cardápio digital.",
    ].join("\n")
    const digits = store.whatsapp.replace(/\D/g, "")
    const phone = digits.startsWith("55") ? digits : `55${digits}`
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener",
    )
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <img className="hero__image" src={store.coverUrl} alt="" />
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
          {isDemo && <span className="demo-badge">Cardápio demo</span>}
          <button
            className="icon-button icon-button--glass cart-shortcut"
            type="button"
            aria-label={`Abrir carrinho com ${itemCount} itens`}
            onClick={() => setCartOpen(true)}
          >
            <ShoppingBag size={20} strokeWidth={2.2} />
            {itemCount > 0 && (
              <span className="cart-shortcut__count">{itemCount}</span>
            )}
          </button>
        </div>
      </header>

      <main>
        <section className="store-card" aria-labelledby="store-name">
          <img
            className="store-card__logo"
            src={store.logoUrl}
            alt={`Logo ${store.name}`}
          />
          <div className="store-card__heading">
            <div>
              <h1 id="store-name">{store.name}</h1>
              <p>{store.description}</p>
            </div>
            <div
              className={`status ${
                store.isOpen ? "status--open" : "status--closed"
              }`}
            >
              <span />
              {store.isOpen ? "Aberto" : "Fechado"}
            </div>
          </div>
          <div className="store-meta">
            <span>
              <Clock3 size={17} />
              {store.eta} · Taxa {currency.format(store.deliveryFee)}
            </span>
            <span>
              <MapPin size={17} />
              Pedido mínimo {currency.format(store.minOrder)}
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
                Estamos fora do horário de atendimento. Você pode consultar o
                cardápio, mas pedidos estão temporariamente pausados.
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

          <nav
            className="category-nav"
            aria-label="Categorias do cardápio"
            ref={navRef}
          >
            {displayCategories.map((category) => (
              <button
                className={
                  activeCategory === category.id && !search ? "is-active" : ""
                }
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
                    : displayCategories.find(
                        (category) => category.id === activeCategory,
                      )?.name || "Cardápio"}
                </h2>
              </div>
              <p>{visibleProducts.length} itens</p>
            </div>

            {visibleProducts.length ? (
              <div className="product-grid">
                {visibleProducts.map((product) => {
                  const quantity = cart[product.id] ?? 0
                  const isAvailable = product.available !== false

                  return (
                    <article
                      className={`product-card ${
                        !isAvailable ? "product-card--soldout" : ""
                      }`}
                      key={product.id}
                    >
                      <div className="product-card__content">
                        {product.popular && isAvailable && (
                          <span className="popular-label">
                            <Check size={13} strokeWidth={3} /> Mais pedido
                          </span>
                        )}
                        {!isAvailable && (
                          <span className="soldout-badge-text">
                            <AlertCircle size={12} /> Esgotado
                          </span>
                        )}
                        <h3>{product.name}</h3>
                        <p>{product.description}</p>
                        <strong>{currency.format(product.price)}</strong>
                      </div>
                      <div className="product-card__media">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          loading="lazy"
                        />
                        {!isAvailable ? (
                          <>
                            <div className="soldout-media-overlay">
                              <span className="soldout-badge">Esgotado</span>
                            </div>
                            <span
                              className="soldout-pill"
                              title="Produto indisponível no momento"
                            >
                              Esgotado
                            </span>
                          </>
                        ) : quantity === 0 ? (
                          <button
                            className="add-button"
                            type="button"
                            aria-label={`Adicionar ${product.name}`}
                            onClick={() => updateQuantity(product.id, 1)}
                          >
                            <Plus size={21} strokeWidth={2.5} />
                          </button>
                        ) : (
                          <div
                            className="inline-stepper"
                            aria-label={`Quantidade de ${product.name}`}
                          >
                            <button
                              type="button"
                              aria-label={`Remover uma unidade de ${product.name}`}
                              onClick={() => updateQuantity(product.id, -1)}
                            >
                              <Minus size={15} />
                            </button>
                            <span>{quantity}</span>
                            <button
                              type="button"
                              aria-label={`Adicionar uma unidade de ${product.name}`}
                              onClick={() => updateQuantity(product.id, 1)}
                            >
                              <Plus size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  )
                })}
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
            <strong>{currency.format(subtotal)}</strong>
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {cartOpen && (
        <div className="drawer-layer" role="presentation">
          <button
            className="drawer-backdrop"
            type="button"
            aria-label="Fechar carrinho"
            onClick={() => setCartOpen(false)}
          />
          <aside
            className="cart-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
          >
            <div className="drawer-handle" />
            <div className="drawer-header">
              <div>
                <span className="drawer-eyebrow">Seu pedido</span>
                <h2 id="cart-title">Sacola de compras</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Fechar sacola"
                onClick={() => setCartOpen(false)}
              >
                <X size={21} />
              </button>
            </div>

            <div className="drawer-scroll">
              {cartItems.length ? (
                <>
                  <div className="cart-items">
                    {cartItems.map(({ product, quantity }) => (
                      <div className="cart-item" key={product.id}>
                        <img src={product.imageUrl} alt="" />
                        <div className="cart-item__info">
                          <h3>
                            {product.name}
                            {product.available === false && (
                              <span
                                style={{
                                  color: "#dc2626",
                                  fontSize: "0.75rem",
                                  marginLeft: "0.375rem",
                                  fontWeight: 700,
                                }}
                              >
                                (Esgotado)
                              </span>
                            )}
                          </h3>
                          <strong>
                            {currency.format(product.price * quantity)}
                          </strong>
                          <input
                            className="item-note"
                            aria-label={`Observação para ${product.name}`}
                            placeholder="Adicionar observação"
                            value={itemNotes[product.id] ?? ""}
                            onChange={(event) =>
                              setItemNotes((current) => ({
                                ...current,
                                [product.id]: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="quantity-stepper">
                          <button
                            type="button"
                            aria-label={`Diminuir ${product.name}`}
                            onClick={() => updateQuantity(product.id, -1)}
                          >
                            {quantity === 1 ? (
                              <Trash2 size={15} />
                            ) : (
                              <Minus size={15} />
                            )}
                          </button>
                          <span>{quantity}</span>
                          <button
                            type="button"
                            aria-label={`Aumentar ${product.name}`}
                            disabled={product.available === false}
                            onClick={() => updateQuantity(product.id, 1)}
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="checkout-section">
                    <div className="checkout-title">
                      <span>1</span>
                      <h3>Dados para entrega</h3>
                    </div>
                    <div className="form-fields">
                      <label className="field">
                        <span>Seu nome completo *</span>
                        <input
                          type="text"
                          placeholder="Ex.: Mariana Costa"
                          value={customerName}
                          onChange={(event) =>
                            setCustomerName(event.target.value)
                          }
                        />
                        {errors.name && (
                          <span className="field-error">{errors.name}</span>
                        )}
                      </label>
                      <label className="field">
                        <span>Seu WhatsApp com DDD *</span>
                        <input
                          type="tel"
                          placeholder="Ex.: (11) 99999-9999"
                          value={customerPhone}
                          onChange={(event) =>
                            setCustomerPhone(event.target.value)
                          }
                        />
                        {errors.phone && (
                          <span className="field-error">{errors.phone}</span>
                        )}
                      </label>
                      <label className="field">
                        <span>Endereço de entrega completo *</span>
                        <textarea
                          rows={2}
                          placeholder="Rua, número, complemento e ponto de referência"
                          value={address}
                          onChange={(event) => setAddress(event.target.value)}
                        />
                        {errors.address && (
                          <span className="field-error">{errors.address}</span>
                        )}
                      </label>
                      <label className="field">
                        <span>Observações para a entrega</span>
                        <input
                          type="text"
                          placeholder="Ex.: Tocar o interfone 204"
                          value={orderNotes}
                          onChange={(event) =>
                            setOrderNotes(event.target.value)
                          }
                        />
                      </label>
                    </div>
                  </div>

                  <div className="checkout-section">
                    <div className="checkout-title">
                      <span>2</span>
                      <h3>Forma de pagamento</h3>
                    </div>
                    <div className="payment-options">
                      {([
                        "Pix",
                        "Cartão na Entrega",
                        "Dinheiro",
                      ] as Payment[]).map((option) => (
                        <button
                          className={payment === option ? "is-selected" : ""}
                          type="button"
                          key={option}
                          onClick={() => setPayment(option)}
                        >
                          <span className="radio-dot">
                            {payment === option && <span />}
                          </span>
                          {option}
                        </button>
                      ))}
                    </div>
                    {payment === "Dinheiro" && (
                      <label className="field cash-field">
                        <span>Precisa de troco para quanto?</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="Ex.: R$ 100,00"
                          value={cashChange}
                          onChange={(event) =>
                            setCashChange(event.target.value)
                          }
                        />
                      </label>
                    )}
                  </div>

                  <div className="order-summary">
                    <div>
                      <span>Subtotal</span>
                      <strong>{currency.format(subtotal)}</strong>
                    </div>
                    <div>
                      <span>Taxa de entrega</span>
                      <strong>{currency.format(store.deliveryFee)}</strong>
                    </div>
                    <div className="order-summary__total">
                      <span>Total</span>
                      <strong>{currency.format(total)}</strong>
                    </div>
                  </div>
                  {errors.order && (
                    <p className="order-error">{errors.order}</p>
                  )}
                </>
              ) : (
                <div className="empty-cart">
                  <div>
                    <ShoppingBag size={32} />
                  </div>
                  <h3>Seu carrinho está vazio</h3>
                  <p>Adicione seus favoritos para começar o pedido.</p>
                  <button type="button" onClick={() => setCartOpen(false)}>
                    Explorar cardápio
                  </button>
                </div>
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="drawer-footer">
                {!store.isOpen ? (
                  <div>
                    <button
                      className="whatsapp-button whatsapp-button--disabled"
                      type="button"
                      disabled
                    >
                      Loja Fechada no Momento
                    </button>
                    <p className="store-closed-cart-notice">
                      Não estamos aceitando novos pedidos enquanto a loja
                      estiver fechada.
                    </p>
                  </div>
                ) : (
                  <>
                    <button
                      className="whatsapp-button"
                      type="button"
                      onClick={sendOrder}
                    >
                      <span className="whatsapp-mark">W</span>
                      Finalizar Pedido via WhatsApp
                      <ChevronRight size={20} />
                    </button>
                    <p>Você será direcionado ao WhatsApp para confirmar.</p>
                  </>
                )}
              </div>
            )}
          </aside>
        </div>
      )}

      <footer>
        <Store size={16} />
        Cardápio digital · {store.name}
      </footer>
    </div>
  )
}
