import { emptyDeliveryAddress } from "@cardapio/domain/delivery-address"
export const sampleAddress = () => ({
  ...emptyDeliveryAddress(),
  street: "Rua São João",
  number: "10",
  neighborhood: "Centro",
  city: "São Paulo",
  state: "SP",
})
