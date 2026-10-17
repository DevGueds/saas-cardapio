import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"
export default function StoreFields() {
  return (
    <>
      <label className="field">
        <span>Nome da loja *</span>
        <ValidatedInput
          name="restaurantName"
          validation="name"
          required
          maxLength={120}
          autoComplete="organization"
          placeholder="Ex.: Sabor da Vila"
        />
      </label>
      <label className="field">
        <span id="store-slug-label">Endereço do cardápio *</span>
        <ValidatedInput
          aria-labelledby="store-slug-label"
          name="slug"
          validation="slug"
          required
          minLength={3}
          maxLength={80}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="sabor-da-vila"
          aria-describedby="store-slug-help"
        />
        <small className="field-help" id="store-slug-help">
          Use letras minúsculas, números e hífens. Seu link será /menu/sabor-da-vila.
        </small>
      </label>
    </>
  )
}
