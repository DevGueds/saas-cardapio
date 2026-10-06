import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router"
import {
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

type StoreData = {
  id: string
  name: string
  description: string
  logoUrl: string
  coverUrl: string
  whatsapp: string
  deliveryFee: number
  minOrder: number
  address: string
  isOpen: boolean
  eta: string
}

type Category = {
  id: string
  name: string
}

type Product = {
  id: string
  categoryId: string
  name: string
  description: string
  price: number
  imageUrl: string
  popular?: boolean
}

type Cart = Record<string, number>
type Payment = "Pix" | "Cartão na Entrega" | "Dinheiro"

const demoStore: StoreData = {
  id: "demo-store",
  name: "Burger House",
  description:
    "Smash burgers artesanais, feitos na brasa e com ingredientes frescos.",
  logoUrl:
    "https://images.unsplash.com/photo-1581574470202-7e344021b092?auto=format&fit=crop&w=240&q=85",
  coverUrl:
    "https://images.unsplash.com/photo-1619810816144-223f5b027aea?auto=format&fit=crop&w=1600&q=88",
  whatsapp: "11999999999",
  deliveryFee: 5,
  minOrder: 25,
  address: "Rua das Flores, 128 · Centro",
  isOpen: true,
  eta: "30–45 min",
}

const demoCategories: Category[] = [
  { id: "popular", name: "Mais Vendidos" },
  { id: "burgers", name: "Hambúrgueres" },
  { id: "drinks", name: "Bebidas" },
  { id: "sides", name: "Sobremesas" },
]

const image = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=700&q=84`

const demoProducts: Product[] = [
  {
    id: "classic",
    categoryId: "popular",
    name: "Smash Clássico",
    description:
      "Pão brioche, carne 120g, queijo cheddar, picles e molho da casa.",
    price: 28,
    imageUrl: image("photo-1619810816144-68dbc1f695e8"),
    popular: true,
  },
  {
    id: "bacon",
    categoryId: "popular",
    name: "Brasa Bacon",
    description:
      "Carne 160g, cheddar duplo, bacon crocante, cebola caramelizada e barbecue.",
    price: 36.9,
    imageUrl: image("photo-1581574470202-7e344021b092"),
    popular: true,
  },
  {
    id: "double",
    categoryId: "burgers",
    name: "Double Smash",
    description:
      "Dois smash burgers de 90g, queijo prato, picles e molho especial.",
    price: 34.9,
    imageUrl: image("photo-1664988851356-cbf205344ff4"),
  },
  {
    id: "salad",
    categoryId: "burgers",
    name: "Brasa Salad",
    description:
      "Carne 160g, queijo, alface, tomate, cebola roxa e maionese verde.",
    price: 32.9,
    imageUrl: image("photo-1619810816144-223f5b027aea"),
  },
  {
    id: "combo",
    categoryId: "combos",
    name: "Combo da Casa",
    description: "Smash Clássico, fritas crocantes e refrigerante lata.",
    price: 44.9,
    imageUrl: image("photo-1780030869912-9e8c35be7866"),
  },
  {
    id: "fries",
    categoryId: "sides",
    name: "Brownie com sorvete",
    description: "Brownie quentinho, sorvete de baunilha e calda de chocolate.",
    price: 19.9,
    imageUrl: image("photo-1772884011435-00b8eeceb1a0"),
  },
  {
    id: "onion",
    categoryId: "sides",
    name: "Churros da Casa",
    description: "Mini churros crocantes com açúcar, canela e doce de leite.",
    price: 17.9,
    imageUrl: image("photo-1780030888502-303c3ac04bb7"),
  },
  {
    id: "soda",
    categoryId: "drinks",
    name: "Refrigerante lata",
    description: "Coca-Cola, Coca-Cola Zero, Guaraná ou Sprite.",
    price: 5,
    imageUrl: image("photo-1629203851122-3726ecdf080e"),
  },
]

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
      logoUrl: rawStore.logo_url ?? demoStore.logoUrl,
      coverUrl: rawStore.cover_url ?? demoStore.coverUrl,
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
      imageUrl: String(product.image_url ?? demoStore.coverUrl),
      popular: Boolean(product.popular),
    })) as Product[],
  }
}

export default function PublicMenu() {
  const navigate = useNavigate()
  const [store, setStore] = useState(demoStore)
  const [categories, setCategories] = useState(demoCategories)
  const [products, setProducts] = useState(demoProducts)
  const [cart, setCart] = useState<Cart>({ classic: 1, soda: 1 })
  const [cartOpen, setCartOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("popular")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [address, setAddress] = useState("")
  const [orderNotes, setOrderNotes] = useState("")
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({
    classic: "Sem cebola",
  })
  const [payment, setPayment] = useState<Payment>("Pix")
  const [cashChange, setCashChange] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isDemo, setIsDemo] = useState(true)
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchSupabaseMenu(getSlug())
      .then((data) => {
        if (!data) return
        setStore(data.store)
        setCategories(data.categories)
        setProducts(data.products)
        setActiveCategory(data.categories[0]?.id ?? "")
        setIsDemo(false)
      })
      .catch(() => setIsDemo(true))
  }, [])

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
          (item): item is { product: Product quantity: number } =>
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
    return products.filter((product) => product.categoryId === activeCategory)
  }, [activeCategory, products, search])

  const updateQuantity = (id: string, delta: number) => {
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
            {categories.map((category) => (
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
                    : categories.find(
                        (category) => category.id === activeCategory,
                      )?.name}
                </h2>
              </div>
              <p>{visibleProducts.length} itens</p>
            </div>

            {visibleProducts.length ? (
              <div className="product-grid">
                {visibleProducts.map((product) => {
                  const quantity = cart[product.id] ?? 0
                  return (
                    <article className="product-card" key={product.id}>
                      <div className="product-card__content">
                        {product.popular && (
                          <span className="popular-label">
                            <Check size={13} strokeWidth={3} /> Mais pedido
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
                        {quantity === 0 ? (
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
            <div className="drawer-heading">
              <div>
                <span>Seu pedido</span>
                <h2 id="cart-title">Carrinho</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Fechar carrinho"
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
                          <h3>{product.name}</h3>
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
                    <label
                      className={errors.name ? "field has-error" : "field"}
                    >
                      <span>Nome Completo</span>
                      <input
                        type="text"
                        placeholder="Digite seu nome"
                        value={customerName}
                        onChange={(event) => {
                          setCustomerName(event.target.value)
                          setErrors((current) => ({ ...current, name: "" }))
                        }}
                      />
                      {errors.name && <small>{errors.name}</small>}
                    </label>
                    <label
                      className={errors.phone ? "field has-error" : "field"}
                    >
                      <span>WhatsApp</span>
                      <input
                        type="tel"
                        placeholder="(11) 99999-9999"
                        value={customerPhone}
                        onChange={(event) => {
                          setCustomerPhone(event.target.value)
                          setErrors((current) => ({ ...current, phone: "" }))
                        }}
                      />
                      {errors.phone && <small>{errors.phone}</small>}
                    </label>
                    <label
                      className={errors.address ? "field has-error" : "field"}
                    >
                      <span>Endereço com número e bairro</span>
                      <textarea
                        rows={3}
                        placeholder="Rua, número, complemento, bairro e referência"
                        value={address}
                        onChange={(event) => {
                          setAddress(event.target.value)
                          setErrors((current) => ({ ...current, address: "" }))
                        }}
                      />
                      {errors.address && <small>{errors.address}</small>}
                    </label>
                    <label className="field">
                      <span>Observações</span>
                      <textarea
                        rows={2}
                        placeholder="Complemento, referência ou instruções"
                        value={orderNotes}
                        onChange={(event) => setOrderNotes(event.target.value)}
                      />
                    </label>
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
