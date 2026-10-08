import React, { useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Info,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react"

import {
  Category,
  Product,
  useSharedCategories,
  useSharedProducts,
} from "./dataStore"

export type { Category, Product }

export type Toast = {
  id: string
  type: "success" | "info" | "warning"
  message: string
}

// Preset gourmet food images from Unsplash for quick selection
const PRESET_IMAGES = [
  {
    label: "Smash Burger",
    url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80",
  },
  {
    label: "Bacon Artesanal",
    url: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80",
  },
  {
    label: "Double Cheese",
    url: "https://images.unsplash.com/photo-1583032015879-672535619379?auto=format&fit=crop&w=600&q=80",
  },
  {
    label: "Fritas Rústicas",
    url: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80",
  },
  {
    label: "Onion Rings",
    url: "https://images.unsplash.com/photo-1639024471287-035186f55a1b?auto=format&fit=crop&w=600&q=80",
  },
  {
    label: "Refrigerante",
    url: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=600&q=80",
  },
  {
    label: "Suco Natural",
    url: "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80",
  },
  {
    label: "Brownie com Calda",
    url: "https://images.unsplash.com/photo-1564355808539-22fda35bed7e?auto=format&fit=crop&w=600&q=80",
  },
]

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

export default function MenuManagement() {
  const [categories, setCategories] = useSharedCategories()
  const [products, setProducts] = useSharedProducts()

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")

  // Modal State (Novo / Editar Produto)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  // Form Fields
  const [formName, setFormName] = useState("")
  const [formCategory, setFormCategory] = useState("burgers")
  const [formPrice, setFormPrice] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formAvailable, setFormAvailable] = useState(true)
  const [formImageUrl, setFormImageUrl] = useState("")
  const [formImagePreview, setFormImagePreview] = useState("")
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")

  // Delete Confirmation State
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)

  // Toast Notifications
  const [toasts, setToasts] = useState<Toast[]>([])

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const showToast = (message: string, type: Toast["type"] = "success") => {
    setToasts((prev) => {
      if (prev.some((t) => t.message === message)) {
        return prev
      }
      const id = Math.random().toString(36).substring(2, 9)
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id))
      }, 3800)
      return [...prev, { id, message, type }]
    })
  }

  // Open Modal for New Product
  const handleOpenNewModal = (defaultCategory?: string) => {
    setEditingProduct(null)
    setFormName("")
    setFormCategory(defaultCategory || categories[0]?.id || "burgers")
    setFormPrice("")
    setFormDescription("")
    setFormAvailable(true)
    const defaultImg =
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80"
    setFormImageUrl(defaultImg)
    setFormImagePreview(defaultImg)
    setIsAddingNewCategory(false)
    setNewCategoryName("")
    setIsModalOpen(true)
  }

  // Open Modal for Edit
  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product)
    setFormName(product.name)
    setFormCategory(product.categoryId)
    setFormPrice(
      product.price.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    )
    setFormDescription(product.description)
    setFormAvailable(product.available)
    setFormImageUrl(product.imageUrl)
    setFormImagePreview(product.imageUrl)
    setIsAddingNewCategory(false)
    setNewCategoryName("")
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingProduct(null)
  }

  // Handle Image File Selection (Local upload & FileReader preview)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast("O arquivo deve ter no máximo 5MB", "warning")
        return
      }
      const reader = new FileReader()
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string
        setFormImagePreview(result)
        setFormImageUrl(result)
        showToast("Imagem selecionada e otimizada com sucesso!", "info")
      }
      reader.readAsDataURL(file)
    }
  }

  // Save Product (Create or Update)
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formName.trim()) {
      showToast("Por favor, preencha o nome do produto.", "warning")
      return
    }

    const cleanedPrice = formPrice.replace(/\./g, "").replace(",", ".")
    const parsedPrice = parseFloat(cleanedPrice)
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      showToast("Por favor, informe um preço de venda válido.", "warning")
      return
    }

    let targetCategoryId = formCategory
    if (isAddingNewCategory && newCategoryName.trim()) {
      const newCatId = newCategoryName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-")
      const newCat: Category = {
        id: newCatId,
        name: newCategoryName.trim(),
      }
      setCategories((prev) => [...prev, newCat])
      targetCategoryId = newCatId
      showToast(`Categoria "${newCategoryName.trim()}" criada!`, "info")
    }

    const finalImage =
      formImageUrl ||
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80"

    if (editingProduct) {
      // Update
      setProducts((prev) =>
        prev.map((item) =>
          item.id === editingProduct.id
            ? {
                ...item,
                name: formName.trim(),
                categoryId: targetCategoryId,
                price: parsedPrice,
                description: formDescription.trim(),
                available: formAvailable,
                imageUrl: finalImage,
              }
            : item,
        ),
      )
      showToast(`Produto "${formName.trim()}" atualizado com sucesso!`)
    } else {
      // Create new
      const newProduct: Product = {
        id: `prod-${Date.now()}`,
        name: formName.trim(),
        categoryId: targetCategoryId,
        price: parsedPrice,
        description: formDescription.trim(),
        available: formAvailable,
        imageUrl: finalImage,
      }
      setProducts((prev) => [newProduct, ...prev])
      showToast(`Produto "${formName.trim()}" cadastrado com sucesso!`)
    }

    handleCloseModal()
  }

  // Status Toggle (Disponível in green / Esgotado in gray)
  const handleToggleStatus = (productId: string) => {
    const target = products.find((item) => item.id === productId)
    if (!target) return

    const nextState = !target.available
    if (nextState) {
      showToast(`"${target.name}" agora está disponível no cardápio!`)
    } else {
      showToast(
        `"${target.name}" foi pausado (Esgotado) no cardápio.`,
        "warning",
      )
    }

    setProducts((prev) =>
      prev.map((item) =>
        item.id === productId ? { ...item, available: nextState } : item,
      ),
    )
  }

  // Confirm delete product
  const confirmDeleteProduct = () => {
    if (!productToDelete) return
    const deleted = productToDelete
    setProducts((prev) => prev.filter((item) => item.id !== deleted.id))
    setProductToDelete(null)
    showToast(`"${deleted.name}" foi excluído do cardápio.`, "info")
  }

  // Filtered products based on search and category
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query)

      const matchesCategory =
        selectedCategoryFilter === "all" ||
        product.categoryId === selectedCategoryFilter

      return matchesSearch && matchesCategory
    })
  }, [products, searchQuery, selectedCategoryFilter])

  // Group filtered products by category
  const groupedProducts = useMemo(() => {
    const map = new Map<string, Product[]>()

    categories.forEach((cat) => {
      if (
        selectedCategoryFilter === "all" ||
        selectedCategoryFilter === cat.id
      ) {
        map.set(cat.id, [])
      }
    })

    filteredProducts.forEach((prod) => {
      if (!map.has(prod.categoryId)) {
        map.set(prod.categoryId, [])
      }
      map.get(prod.categoryId)!.push(prod)
    })

    return Array.from(map.entries())
      .map(([catId, items]) => {
        const catObj = categories.find((c) => c.id === catId) || {
          id: catId,
          name: catId.charAt(0).toUpperCase() + catId.slice(1),
        }
        return {
          category: catObj,
          items,
        }
      })
      .filter((group) => (searchQuery ? group.items.length > 0 : true))
  }, [categories, filteredProducts, searchQuery, selectedCategoryFilter])

  // Metrics
  const totalCount = products.length
  const availableCount = products.filter((p) => p.available).length
  const unavailableCount = totalCount - availableCount

  return (
    <div className="menu-mgmt-wrapper w-full max-w-[90rem] mx-auto transition-all">
      {/* 1. TOP ACTION BAR */}
      <section className="bg-white border border-slate-200/90 px-6 lg:px-8 py-6 mb-8 rounded-2xl shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          {/* Left: Page Title, Subtitle, and Metrics Summary */}
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100/80 shadow-xs">
                <UtensilsCrossed size={22} />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-manrope">
                  Gestão do Cardápio
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Cadastre, edite e pause produtos em tempo real
                </p>
              </div>
            </div>

            {/* Quick Metrics Badges */}
            <div className="flex items-center flex-wrap gap-2.5 mt-3.5 pt-2 border-t border-slate-100">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                {totalCount} {totalCount === 1 ? "Produto" : "Produtos"}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {availableCount} Disponíveis no cardápio
              </span>
              {unavailableCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  {unavailableCount} Esgotado / Pausado
                </span>
              )}
            </div>
          </div>

          {/* Right Side: Search bar, Category filter dropdown, View Switcher & Primary Green Button "+ Novo Produto" */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Bar */}
            <div className="relative min-w-[16.25rem] flex-1 sm:flex-initial">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome ou ingrediente..."
                className="w-full h-11 pl-10 pr-9 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 focus:outline-hidden transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                  title="Limpar busca"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category Filter Dropdown */}
            <div className="relative">
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="h-11 appearance-none pl-3.5 pr-9 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-slate-300 focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 focus:outline-hidden cursor-pointer transition-all shadow-2xs"
              >
                <option value="all">Todas as categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={15}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>

            {/* Grid vs Table View Switcher */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-white text-emerald-700 shadow-xs font-semibold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Visualização em Cards"
                aria-label="Cards Grid"
              >
                <LayoutGrid size={17} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white text-emerald-700 shadow-xs font-semibold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Visualização em Tabela"
                aria-label="Table View"
              >
                <List size={17} />
              </button>
            </div>

            {/* Primary Green Button: + Novo Produto */}
            <button
              type="button"
              onClick={() => handleOpenNewModal()}
              className="h-11 px-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm shadow-sm hover:shadow-md hover:shadow-emerald-600/20 active:scale-[0.99] transition-all cursor-pointer"
            >
              <Plus size={18} strokeWidth={2.4} />
              <span>Novo Produto</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. PRODUCT CATALOG: LIST GROUPED BY CATEGORY */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto my-12 shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-4">
            <Search size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">
            Nenhum produto encontrado
          </h3>
          <p className="text-sm text-slate-500 mb-6">
            Não encontramos itens correspondentes a "{searchQuery}". Tente outro
            termo de busca ou cadastre um novo produto.
          </p>
          <div className="flex items-center justify-center gap-3">
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              >
                Limpar Busca
              </button>
            )}
            <button
              type="button"
              onClick={() => handleOpenNewModal()}
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all"
            >
              + Cadastrar Produto
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-10 pb-16">
          {groupedProducts.map((group) => {
            const hasItems = group.items.length > 0
            if (!hasItems && searchQuery) return null

            return (
              <section
                key={group.category.id}
                className="category-section"
                aria-labelledby={`category-title-${group.category.id}`}
              >
                {/* Category Header */}
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200/90">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold">
                      {group.category.name.charAt(0)}
                    </span>
                    <h2
                      id={`category-title-${group.category.id}`}
                      className="text-lg font-bold text-slate-900 tracking-tight font-manrope"
                    >
                      {group.category.name}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                      {group.items.length}{" "}
                      {group.items.length === 1 ? "item" : "itens"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenNewModal(group.category.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    Adicionar em {group.category.name}
                  </button>
                </div>

                {/* VIEW MODE: CARD GRID */}
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                    {group.items.map((product) => {
                      return (
                        <article
                          key={product.id}
                          className={`relative flex flex-col justify-between bg-white border rounded-2xl p-4 transition-all duration-200 hover:shadow-md ${
                            product.available
                              ? "border-slate-200/80 hover:border-emerald-300"
                              : "border-slate-200/60 bg-slate-50/60 opacity-90"
                          }`}
                        >
                          <div>
                            {/* Card Top: Thumbnail + Product Info */}
                            <div className="flex gap-3.5 items-start">
                              {/* Square Thumbnail with Rounded Corners */}
                              <div className="relative shrink-0 w-20 h-20 sm:w-22 sm:h-22 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/70">
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className={`w-full h-full object-cover transition-transform duration-300 hover:scale-105 ${
                                    !product.available
                                      ? "grayscale-50 contrast-90"
                                      : ""
                                  }`}
                                  loading="lazy"
                                />
                                {!product.available && (
                                  <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center">
                                    <span className="text-[0.625rem] font-bold tracking-wider uppercase text-white bg-slate-900/80 px-1.5 py-0.5 rounded-sm">
                                      Pausado
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Title & Description */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <h3
                                    className={`text-sm font-bold truncate ${
                                      product.available
                                        ? "text-slate-900"
                                        : "text-slate-700"
                                    }`}
                                    title={product.name}
                                  >
                                    {product.name}
                                  </h3>
                                  {product.popular && (
                                    <span
                                      className="shrink-0 inline-flex items-center gap-0.5 text-[0.625rem] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200/60"
                                      title="Item popular"
                                    >
                                      <Sparkles size={10} />
                                      Top
                                    </span>
                                  )}
                                </div>
                                <p
                                  className="text-xs text-slate-500 line-clamp-2 leading-relaxed"
                                  title={product.description}
                                >
                                  {product.description}
                                </p>
                              </div>
                            </div>

                            {/* Price (Bold Emerald Text) */}
                            <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                              <span className="text-[0.6875rem] font-medium text-slate-400 uppercase tracking-wider">
                                Preço
                              </span>
                              <span className="text-base font-extrabold text-emerald-700 tracking-tight font-manrope">
                                {currency.format(product.price)}
                              </span>
                            </div>
                          </div>

                          {/* Card Footer: Status Toggle Switch + Action Buttons ("Editar" & "Excluir") */}
                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            {/* Status Toggle Switch ("Disponível" in green / "Esgotado" in gray) */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={product.available}
                                onClick={() => handleToggleStatus(product.id)}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                                  product.available
                                    ? "bg-emerald-600"
                                    : "bg-slate-300"
                                }`}
                                title={
                                  product.available
                                    ? "Clique para pausar (Esgotado)"
                                    : "Clique para ativar (Disponível)"
                                }
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out mt-0.5 ${
                                    product.available
                                      ? "translate-x-5.5 ml-0"
                                      : "translate-x-0.5"
                                  }`}
                                />
                              </button>

                              <span
                                className={`text-xs font-semibold select-none ${
                                  product.available
                                    ? "text-emerald-700"
                                    : "text-slate-500"
                                }`}
                              >
                                {product.available ? "Disponível" : "Esgotado"}
                              </span>
                            </div>

                            {/* Action Buttons: "Editar" (pencil icon) & "Excluir" (trash icon) */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(product)}
                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all cursor-pointer"
                                title="Editar produto"
                                aria-label={`Editar ${product.name}`}
                              >
                                <Pencil size={15} />
                              </button>

                              <button
                                type="button"
                                onClick={() => setProductToDelete(product)}
                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                                title="Excluir produto"
                                aria-label={`Excluir ${product.name}`}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  /* VIEW MODE: TABLE CATALOG */
                  <div className="overflow-x-auto bg-white border border-slate-200/90 rounded-2xl shadow-xs">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 tracking-wider">
                          <th className="py-3 px-4">Produto</th>
                          <th className="py-3 px-4 hidden md:table-cell">
                            Categoria
                          </th>
                          <th className="py-3 px-4">Preço</th>
                          <th className="py-3 px-4 text-center">Status</th>
                          <th className="py-3 px-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.items.map((product) => (
                          <tr
                            key={product.id}
                            className={`hover:bg-slate-50/70 transition-colors ${
                              !product.available ? "bg-slate-50/30" : ""
                            }`}
                          >
                            {/* Product Info (Thumbnail + Name + Description) */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3.5">
                                <div className="relative shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80">
                                  <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    className={`w-full h-full object-cover ${
                                      !product.available ? "grayscale-50" : ""
                                    }`}
                                  />
                                </div>
                                <div className="min-w-0 max-w-md">
                                  <div className="flex items-center gap-1.5">
                                    <strong className="text-slate-900 font-semibold text-sm">
                                      {product.name}
                                    </strong>
                                    {product.popular && (
                                      <span className="text-[0.625rem] font-bold text-amber-700 bg-amber-50 px-1 rounded-sm">
                                        Top
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 line-clamp-1">
                                    {product.description}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Category */}
                            <td className="py-3 px-4 hidden md:table-cell text-slate-600 text-xs font-medium">
                              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                                {group.category.name}
                              </span>
                            </td>

                            {/* Price (Bold emerald text) */}
                            <td className="py-3 px-4">
                              <span className="text-sm font-extrabold text-emerald-700 font-manrope">
                                {currency.format(product.price)}
                              </span>
                            </td>

                            {/* Status Toggle Switch ("Disponível" in green / "Esgotado" in gray) */}
                            <td className="py-3 px-4 text-center">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={product.available}
                                  onClick={() => handleToggleStatus(product.id)}
                                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-hidden ${
                                    product.available
                                      ? "bg-emerald-600"
                                      : "bg-slate-300"
                                  }`}
                                  title={
                                    product.available
                                      ? "Clique para pausar"
                                      : "Clique para ativar"
                                  }
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out mt-0.5 ${
                                      product.available
                                        ? "translate-x-5.5"
                                        : "translate-x-0.5"
                                    }`}
                                  />
                                </button>
                                <span
                                  className={`text-xs font-semibold w-18 text-left ${
                                    product.available
                                      ? "text-emerald-700"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {product.available
                                    ? "Disponível"
                                    : "Esgotado"}
                                </span>
                              </div>
                            </td>

                            {/* Action Buttons: "Editar" (pencil) and "Excluir" (trash) */}
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(product)}
                                  className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                  title="Editar"
                                  aria-label={`Editar ${product.name}`}
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setProductToDelete(product)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Excluir"
                                  aria-label={`Excluir ${product.name}`}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* 3. "NOVO / EDITAR PRODUTO" MODAL DIALOG */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-headline"
        >
          {/* Modal Container */}
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3
                  id="modal-headline"
                  className="text-lg font-bold text-slate-900 font-manrope"
                >
                  {editingProduct ? "Editar Produto" : "Cadastrar Novo Produto"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Preencha as informações do item para exibir no cardápio
                  digital.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Fechar"
              >
                <X size={19} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProduct} className="p-6 space-y-5">
              {/* Photo Upload Area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Foto do Produto
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                />

                {/* Drag-and-drop / Upload Box */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const file = e.dataTransfer.files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onload = (uploadEvent) => {
                        const result = uploadEvent.target?.result as string
                        setFormImagePreview(result)
                        setFormImageUrl(result)
                      }
                      reader.readAsDataURL(file)
                    }
                  }}
                  className="relative group cursor-pointer border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-4 transition-all duration-200 bg-slate-50/60 hover:bg-emerald-50/30 text-center"
                >
                  {formImagePreview ? (
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {/* Image Preview Box */}
                      <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200 shrink-0 shadow-xs">
                        <img
                          src={formImagePreview}
                          alt="Pré-visualização do produto"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-900/20 group-hover:bg-transparent transition-colors" />
                      </div>

                      {/* Details & Action */}
                      <div className="text-left flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-1">
                          <CheckCircle2 size={15} />
                          Foto selecionada com sucesso
                        </div>
                        <p className="text-xs text-slate-500 mb-2">
                          PNG ou JPG até 5MB (será otimizado automaticamente)
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              fileInputRef.current?.click()
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Trocar foto
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setFormImagePreview("")
                              setFormImageUrl("")
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-2.5 group-hover:scale-110 transition-transform">
                        <Camera size={22} />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">
                        Clique para enviar ou arraste a imagem aqui
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        PNG ou JPG até 5MB (será otimizado automaticamente)
                      </p>
                    </div>
                  )}
                </div>

                {/* Quick Presets Picker */}
                <div className="mt-2.5 flex items-center gap-2 flex-wrap text-xs text-slate-500">
                  <span className="text-[0.6875rem] font-medium text-slate-400">
                    Sugestões rápidas:
                  </span>
                  {PRESET_IMAGES.slice(0, 6).map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setFormImagePreview(preset.url)
                        setFormImageUrl(preset.url)
                      }}
                      className="text-[0.6875rem] font-medium px-2 py-0.5 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nome do Produto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nome do Produto <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="ex: Smash Bacon Duplo"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 focus:outline-hidden transition-all"
                />
              </div>

              {/* Two Column Row: Categoria + Preço de Venda */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Categoria */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Categoria <span className="text-rose-500">*</span>
                    </label>
                  </div>

                  {!isAddingNewCategory ? (
                    <div className="relative">
                      <select
                        value={formCategory}
                        onChange={(e) => {
                          if (e.target.value === "__new__") {
                            setIsAddingNewCategory(true)
                          } else {
                            setFormCategory(e.target.value)
                          }
                        }}
                        className="w-full h-11 appearance-none pl-3.5 pr-9 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 focus:outline-hidden cursor-pointer transition-all"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                        <option
                          value="__new__"
                          className="font-semibold text-emerald-700"
                        >
                          + Nova Categoria
                        </option>
                      </select>
                      <ChevronDown
                        size={15}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Nome da categoria"
                        className="flex-1 h-11 px-3 rounded-xl border border-emerald-500 bg-white text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingNewCategory(false)
                          setNewCategoryName("")
                        }}
                        className="h-11 px-2.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl cursor-pointer"
                        title="Cancelar nova categoria"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Preço de Venda */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Preço de Venda <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-sm font-bold text-slate-400 pointer-events-none">
                      R$
                    </span>
                    <input
                      type="text"
                      required
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      placeholder="28,00"
                      className="w-full h-11 pl-11 pr-3.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 focus:outline-hidden transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Descrição dos Ingredientes (textarea de 3 linhas) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Descrição dos Ingredientes
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="ex: Pão brioche artesanal, 2x smash burger de 90g, queijo cheddar inglês cremoso, tiras de bacon crocante e maionese defumada."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 focus:outline-hidden transition-all resize-none leading-relaxed"
                />
              </div>

              {/* Checkbox: Produto já disponível para venda no cardápio */}
              <div className="pt-2">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex items-center pt-0.5">
                    <input
                      type="checkbox"
                      checked={formAvailable}
                      onChange={(e) => setFormAvailable(e.target.checked)}
                      className="h-4.5 w-4.5 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                    />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-slate-800 group-hover:text-emerald-700 transition-colors">
                      Produto já disponível para venda no cardápio
                    </span>
                    <p className="text-xs text-slate-500">
                      Se desmarcado, o item aparecerá pausado como "Esgotado"
                      para os clientes.
                    </p>
                  </div>
                </label>
              </div>

              {/* Modal Footer Buttons */}
              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="h-11 px-5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm shadow-sm hover:shadow-md hover:shadow-emerald-600/20 transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <Check size={17} strokeWidth={2.4} />
                  <span>Salvar Produto</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. DELETE CONFIRMATION DIALOG */}
      {productToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
                <Trash2 size={20} />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Excluir Produto
                </h3>
                <p className="text-xs text-slate-500">
                  Esta ação removerá o item do cardápio digital
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Tem certeza que deseja excluir o produto{" "}
              <strong className="text-slate-900 font-semibold">
                "{productToDelete.name}"
              </strong>
              ?
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="h-10 px-4 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteProduct}
                className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. FLOATING TOAST NOTIFICATIONS */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all duration-300 animate-in slide-in-from-bottom-2 ${
              toast.type === "success"
                ? "bg-slate-900 text-white border border-slate-800"
                : toast.type === "warning"
                  ? "bg-amber-900 text-amber-50 border border-amber-800"
                  : "bg-slate-800 text-white"
            }`}
          >
            {toast.type === "success" ? (
              <span className="text-emerald-400">
                <CheckCircle2 size={17} />
              </span>
            ) : toast.type === "warning" ? (
              <span className="text-amber-400">
                <AlertCircle size={17} />
              </span>
            ) : (
              <span className="text-sky-400">
                <Info size={17} />
              </span>
            )}
            <span className="flex-1">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
