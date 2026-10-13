import type { DemoOrder } from "../domain/demo-order"

export const demoOrders: DemoOrder[] = [
  {
    id: "1048",

    time: "há 2 min",

    customer: "Mariana Costa",

    items: ["2x Smash Clássico", "1x Fritas com cheddar", "2x Coca-Cola Zero"],

    total: 8280,

    paymentMethod: "Pix",

    paymentStatus: "confirmed",

    status: "new",
  },

  {
    id: "1047",

    time: "há 7 min",

    customer: "Rafael Lima",

    items: ["1x Brasa Bacon", "1x Onion Rings", "1x Guaraná"],

    total: 6280,

    paymentMethod: "Dinheiro",

    paymentStatus: "pending",

    status: "new",
  },

  {
    id: "1046",

    time: "há 14 min",

    customer: "Camila Rocha",

    items: ["2x Combo da Casa", "1x Fritas pequena"],

    total: 10870,

    paymentMethod: "Cartão",

    paymentStatus: "pending",

    status: "new",
  },

  {
    id: "1045",

    time: "há 21 min",

    customer: "Paulo Mendes",

    items: ["1x Double Smash", "1x Coca-Cola"],

    total: 4690,

    paymentMethod: "Pix",

    paymentStatus: "confirmed",

    status: "preparing",
  },

  {
    id: "1044",

    time: "há 28 min",

    customer: "Bianca Alves",

    items: ["2x Brasa Salad", "2x Suco de laranja"],

    total: 8380,

    paymentMethod: "Pix",

    paymentStatus: "confirmed",

    status: "preparing",
  },

  {
    id: "1043",

    time: "há 43 min",

    customer: "Lucas Freire",

    items: ["1x Combo da Casa", "1x Milk-shake"],

    total: 6290,

    paymentMethod: "Cartão",

    paymentStatus: "confirmed",

    status: "delivery",
  },
]
