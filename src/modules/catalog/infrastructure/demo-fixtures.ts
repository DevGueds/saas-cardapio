export const INITIAL_STORE = {
  id: "demo-store",

  name: "Burger House",

  description: "Smash burgers artesanais, feitos na brasa e com ingredientes frescos.",

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

export const INITIAL_CATEGORIES = [
  { id: "burgers", name: "Hambúrgueres" },

  { id: "sides", name: "Acompanhamentos" },

  { id: "drinks", name: "Bebidas" },

  { id: "desserts", name: "Sobremesas" },
]

export const INITIAL_PRODUCTS = [
  {
    id: "prod-1",

    categoryId: "burgers",

    name: "Smash Clássico",

    description:
      "Pão brioche artesanal tostado na manteiga, blend smash 120g, queijo cheddar inglês derretido, picles crocantes e molho especial da casa.",

    price: 28.0,

    imageUrl:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80",

    available: true,

    popular: true,
  },

  {
    id: "prod-2",

    categoryId: "burgers",

    name: "Brasa Bacon Duplo",

    description:
      "Carne 160g assada na brasa de carvão, generosas fatias de bacon artesanal crocante, cheddar inglês duplo, cebola caramelizada e barbecue.",

    price: 36.9,

    imageUrl:
      "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80",

    available: true,

    popular: true,
  },

  {
    id: "prod-3",

    categoryId: "burgers",

    name: "Double Smash Cheese",

    description:
      "Dois smash burgers ultra selados de 90g cada, queijo prato derretido duplo, picles em fatias e maionese verde artesanal.",

    price: 34.9,

    imageUrl:
      "https://images.unsplash.com/photo-1583032015879-672535619379?auto=format&fit=crop&w=600&q=80",

    available: true,
  },

  {
    id: "prod-4",

    categoryId: "burgers",

    name: "Brasa Salad Especial",

    description:
      "Blend 160g suculento, queijo estepe, alface americana fresca, tomate caqui em rodelas, cebola roxa fininha e maionese verde de ervas.",

    price: 32.9,

    imageUrl:
      "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80",

    available: true,
  },

  {
    id: "prod-5",

    categoryId: "burgers",

    name: "Trufado Melt Gourmet",

    description:
      "Blend nobre 180g, creme de queijos com azeite trufado branco, cogumelos paris salteados na manteiga e cebola crispy artesanal.",

    price: 42.0,

    imageUrl:
      "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=600&q=80",

    available: false, // Esgotado / Pausado para demonstração
  },

  {
    id: "prod-6",

    categoryId: "sides",

    name: "Batata Frita Rústica Especial",

    description:
      "Batatas rústicas com casca cortadas à mão, alecrim fresco, flor de sal e maionese verde especial da casa.",

    price: 24.0,

    imageUrl:
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80",

    available: true,
  },

  {
    id: "prod-7",

    categoryId: "sides",

    name: "Batata com Cheddar & Bacon",

    description:
      "Porção generosa de fritas crocantes com fondue cremoso de queijo cheddar e farofa crocante de bacon artesanal.",

    price: 29.9,

    imageUrl:
      "https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=600&q=80",

    available: true,
  },

  {
    id: "prod-8",

    categoryId: "sides",

    name: "Onion Rings Artesanais",

    description:
      "Anéis de cebola doce empanados em farinha panko temperada e crocante. Acompanha molho barbecue artesanal defumado.",

    price: 22.0,

    imageUrl:
      "https://images.unsplash.com/photo-1639024471287-035186f55a1b?auto=format&fit=crop&w=600&q=80",

    available: true,
  },

  {
    id: "prod-9",

    categoryId: "drinks",

    name: "Coca-Cola Lata 350ml",

    description:
      "Refrigerante Coca-Cola em lata 350ml bem gelado (Normal ou Zero Açúcar).",

    price: 6.0,

    imageUrl:
      "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=600&q=80",

    available: true,
  },

  {
    id: "prod-10",

    categoryId: "drinks",

    name: "Guaraná Antarctica 350ml",

    description:
      "O autêntico sabor brasileiro da fruta guaraná, lata de 350ml servida estupidamente gelada.",

    price: 6.0,

    imageUrl:
      "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80",

    available: true,
  },

  {
    id: "prod-11",

    categoryId: "drinks",

    name: "Suco Natural de Laranja 500ml",

    description:
      "Suco 100% natural espremido na hora com laranjas selecionadas, sem água e sem açúcar adicionado.",

    price: 11.0,

    imageUrl:
      "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80",

    available: true,
  },

  {
    id: "prod-12",

    categoryId: "desserts",

    name: "Brownie com Sorvete e Calda",

    description:
      "Brownie de chocolate belga quentinho com pedaços de nozes, sorvete artesanal de baunilha e calda de chocolate.",

    price: 19.9,

    imageUrl:
      "https://images.unsplash.com/photo-1564355808539-22fda35bed7e?auto=format&fit=crop&w=600&q=80",

    available: true,
  },

  {
    id: "prod-13",

    categoryId: "desserts",

    name: "Mini Churros com Doce de Leite",

    description:
      "6 unidades de mini churros crocantes polvilhados com açúcar e canela, servidos com pote de doce de leite cremoso.",

    price: 17.0,

    imageUrl:
      "https://images.unsplash.com/photo-1624300629298-e9de39c13be5?auto=format&fit=crop&w=600&q=80",

    available: true,
  },
]
