import { memo, useCallback, useMemo, useState } from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  type NewIndexGetter,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowDown, ArrowUp, GripVertical, Pencil, Trash2 } from "lucide-react"
import type { Category } from "@cardapio/domain/catalog"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useMutation } from "../../../shared/presentation/use-mutation"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import { notifySuccess } from "../../../shared/presentation/notify"
import { projectedCategoryIndex } from "../application/category-position"

interface RowProps {
  category: Category
  count: number
  index: number
  length: number
  disabled: boolean
  onEdit(category: Category): void
  onDelete(category: Category): void
  onMove(id: string, delta: number): void
}
const CategoryRow = memo(function CategoryRow({
  category,
  count,
  index,
  length,
  disabled,
  onEdit,
  onDelete,
  onMove,
}: RowProps) {
  const getNewIndex = useCallback<NewIndexGetter>(
    ({ activeIndex, overIndex }) => projectedCategoryIndex(index, activeIndex, overIndex),
    [index],
  )
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isSorting,
    newIndex,
  } = useSortable({ id: category.id, disabled, getNewIndex })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`category-order-row${isDragging ? " is-dragging" : ""}`}
      data-category-id={category.id}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="icon-button category-drag-handle"
        disabled={disabled || length < 2}
        {...attributes}
        {...listeners}
        aria-label={`Arrastar categoria ${category.name}`}
      >
        <GripVertical size={21} aria-hidden="true" />
      </button>
      <div className="category-order-row__name">
        <strong>{category.name}</strong>
        <small>
          {(isSorting ? newIndex : index) + 1}ª no cardápio · {count}{" "}
          {count === 1 ? "produto" : "produtos"}
        </small>
      </div>
      <div className="category-order-row__actions">
        <button
          type="button"
          className="icon-button"
          disabled={disabled || index === 0}
          aria-label={`Subir categoria ${category.name}`}
          onClick={() => onMove(category.id, -1)}
        >
          <ArrowUp size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-button"
          disabled={disabled || index === length - 1}
          aria-label={`Descer categoria ${category.name}`}
          onClick={() => onMove(category.id, 1)}
        >
          <ArrowDown size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="text-button"
          disabled={disabled}
          aria-label={`Editar categoria ${category.name}`}
          onClick={() => onEdit(category)}
        >
          <Pencil size={17} aria-hidden="true" />
          <span>Editar</span>
        </button>
        <button
          type="button"
          className="text-button"
          disabled={disabled || count > 0}
          aria-label={`Excluir categoria ${category.name}`}
          title={count ? "Mova os produtos antes de excluir" : undefined}
          onClick={() => onDelete(category)}
        >
          <Trash2 size={17} aria-hidden="true" />
          <span>Excluir</span>
        </button>
      </div>
    </li>
  )
})

export default function CategoryOrdering({
  disabled,
  onEdit,
  onDelete,
}: Pick<RowProps, "disabled" | "onEdit" | "onDelete">) {
  const { menu, reload } = useMenu(),
    { catalog } = useServices(),
    mutation = useMutation()
  const [plan, setPlan] = useState<{ revision: number; ids: string[] } | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const categories = useMemo(
    () => new Map(menu.categories.map((category) => [category.id, category])),
    [menu.categories],
  )
  const ids = useMemo(() => {
    if (!plan) return menu.categories.map((category) => category.id)
    const remaining = new Set(categories.keys())
    const ordered = plan.ids.filter((id) => remaining.delete(id))
    return [...ordered, ...remaining]
  }, [plan, menu.categories, categories])
  const counts = useMemo(() => {
    const result = new Map<string, number>()
    for (const product of menu.products)
      result.set(product.categoryId, (result.get(product.categoryId) ?? 0) + 1)
    return result
  }, [menu.products])
  const dirty = ids.some((id, index) => menu.categories[index]?.id !== id)
  const blocked = disabled || mutation.pending
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const move = useCallback(
    (id: string, delta: number) => {
      const from = ids.indexOf(id),
        to = Math.max(0, Math.min(ids.length - 1, from + delta))
      if (blocked || from < 0 || from === to) return
      setPlan({
        revision: plan?.revision ?? menu.revision,
        ids: arrayMove(ids, from, to),
      })
      setAnnouncement(
        `${categories.get(id)?.name} agora está na posição ${to + 1}. Salve a ordem para publicar.`,
      )
    },
    [ids, blocked, plan?.revision, menu.revision, categories],
  )
  const name = useCallback(
    (id: string | number) => categories.get(String(id))?.name ?? "Categoria",
    [categories],
  )
  const announcements = useMemo<Announcements>(
    () => ({
      onDragStart: ({ active }) =>
        `${name(active.id)} selecionada. Use as setas para mover, espaço para soltar ou Escape para cancelar.`,
      onDragOver: ({ active, over }) =>
        over
          ? `${name(active.id)} sobre a posição ${ids.indexOf(String(over.id)) + 1}.`
          : `${name(active.id)} fora da lista.`,
      onDragEnd: ({ active, over }) =>
        over
          ? `${name(active.id)} na posição ${ids.indexOf(String(over.id)) + 1}. Salve a ordem para publicar.`
          : "Movimento cancelado.",
      onDragCancel: () => "Movimento cancelado. A ordem foi preservada.",
    }),
    [name, ids],
  )
  const drop = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActive(null)
      if (!over || active.id === over.id || blocked) return
      const from = ids.indexOf(String(active.id)),
        to = ids.indexOf(String(over.id))
      if (from >= 0 && to >= 0) move(String(active.id), to - from)
    },
    [blocked, ids, move],
  )
  async function refresh() {
    const latest = await reload()
    if (latest) {
      setPlan((current) => current && { ...current, revision: latest.revision })
      mutation.clearError()
    }
  }
  async function save() {
    if (blocked || !dirty || !catalog.reorderCategories) return
    const result = await mutation.run(() =>
      catalog.reorderCategories!(
        menu.restaurant.id,
        plan?.revision ?? menu.revision,
        ids,
      ),
    )
    if (result?.ok) {
      setPlan(null)
      setAnnouncement("Ordem publicada no cardápio.")
      notifySuccess("Ordem das categorias salva.")
    }
  }
  return (
    <div className="category-ordering">
      <p className="field-help">
        Arraste pelo ícone de pontos para escolher o que aparece primeiro. Você também
        pode usar as setas. Salve a ordem para publicar no cardápio.
      </p>
      {mutation.error && (
        <ErrorNotice error={mutation.error} onRetry={() => void refresh()} />
      )}
      {plan && plan.revision !== menu.revision && !mutation.error && (
        <p className="info-notice">
          O cardápio foi atualizado. Sua ordem foi preservada.{" "}
          <button type="button" className="text-button" onClick={() => void refresh()}>
            Atualizar dados e revisar
          </button>
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setActive(String(active.id))}
        onDragEnd={drop}
        onDragCancel={() => setActive(null)}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "Para organizar, pressione espaço, mova com as setas e pressione espaço novamente para soltar. Escape cancela o movimento.",
          },
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul
            className="category-order-list"
            aria-label="Ordem das categorias no cardápio"
          >
            {ids.map((id, index) => (
              <CategoryRow
                key={id}
                category={categories.get(id)!}
                index={index}
                length={ids.length}
                count={counts.get(id) ?? 0}
                disabled={blocked}
                onEdit={onEdit}
                onDelete={onDelete}
                onMove={move}
              />
            ))}
          </ul>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {active ? (
            <div className="category-drag-preview">
              <GripVertical size={22} />
              <strong>{name(active)}</strong>
              <small>Solte na posição desejada</small>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <p className="category-order-feedback" role="status" aria-live="polite">
        {announcement}
      </p>
      {dirty && (
        <div className="category-order-actions">
          <span>Ordem alterada · ainda não publicada</span>
          <button
            type="button"
            className="secondary-button"
            disabled={blocked}
            onClick={() => {
              setPlan(null)
              mutation.clearError()
              setAnnouncement("Ordem anterior restaurada.")
            }}
          >
            Desfazer ordem
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={blocked || !catalog.reorderCategories}
            onClick={() => void save()}
          >
            {mutation.pending ? "Salvando…" : "Salvar ordem"}
          </button>
        </div>
      )}
    </div>
  )
}
