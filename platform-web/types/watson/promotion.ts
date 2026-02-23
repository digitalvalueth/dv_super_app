// Types for Promotion Master Data

export interface PromotionItem {
  itemCode: string;
  itemName: string;
  stdPrice: number;
  promoPrice: number | null;
  promoStart: Date | null;
  promoEnd: Date | null;
}

export interface PromotionMaster {
  items: PromotionItem[];
  lastUpdated: Date | null;
}

export interface PriceInfo {
  itemCode: string;
  stdPrice: number | null;
  promoPrice: number | null;
  isPromoActive: boolean;
  promoStart: Date | null;
  promoEnd: Date | null;
  priceDiff: number | null;
}

// Sample promotion data (40 items)
export const DEFAULT_PROMOTION_DATA: PromotionItem[] = [
  {
    itemCode: "303812",
    itemName: "#NestMe Chocolate 35g",
    stdPrice: 35,
    promoPrice: 29,
    promoStart: new Date("2026-01-01"),
    promoEnd: new Date("2026-03-31"),
  },
  {
    itemCode: "303813",
    itemName: "#NestMe Vanilla 35g",
    stdPrice: 35,
    promoPrice: 29,
    promoStart: new Date("2026-01-01"),
    promoEnd: new Date("2026-03-31"),
  },
  {
    itemCode: "303814",
    itemName: "#NestMe Strawberry 35g",
    stdPrice: 35,
    promoPrice: 29,
    promoStart: new Date("2026-01-01"),
    promoEnd: new Date("2026-03-31"),
  },
  {
    itemCode: "400101",
    itemName: "Milk Plus 200ml",
    stdPrice: 25,
    promoPrice: 20,
    promoStart: new Date("2026-02-01"),
    promoEnd: new Date("2026-02-28"),
  },
  {
    itemCode: "400102",
    itemName: "Milk Plus 400ml",
    stdPrice: 45,
    promoPrice: 39,
    promoStart: new Date("2026-02-01"),
    promoEnd: new Date("2026-02-28"),
  },
  {
    itemCode: "400103",
    itemName: "Milk Plus 1L",
    stdPrice: 85,
    promoPrice: 75,
    promoStart: new Date("2026-02-01"),
    promoEnd: new Date("2026-02-28"),
  },
  {
    itemCode: "500201",
    itemName: "Snack Bar Original 50g",
    stdPrice: 25,
    promoPrice: null,
    promoStart: null,
    promoEnd: null,
  },
  {
    itemCode: "500202",
    itemName: "Snack Bar Honey 50g",
    stdPrice: 25,
    promoPrice: 22,
    promoStart: new Date("2026-01-15"),
    promoEnd: new Date("2026-04-15"),
  },
  {
    itemCode: "500203",
    itemName: "Snack Bar Nuts 50g",
    stdPrice: 30,
    promoPrice: 25,
    promoStart: new Date("2026-01-15"),
    promoEnd: new Date("2026-04-15"),
  },
  {
    itemCode: "600301",
    itemName: "Energy Drink 250ml",
    stdPrice: 20,
    promoPrice: 15,
    promoStart: new Date("2026-02-01"),
    promoEnd: new Date("2026-02-15"),
  },
  {
    itemCode: "600302",
    itemName: "Energy Drink 500ml",
    stdPrice: 35,
    promoPrice: 30,
    promoStart: new Date("2026-02-01"),
    promoEnd: new Date("2026-02-15"),
  },
  {
    itemCode: "700401",
    itemName: "Vitamin C 1000mg 30 tabs",
    stdPrice: 150,
    promoPrice: 129,
    promoStart: new Date("2026-01-01"),
    promoEnd: new Date("2026-06-30"),
  },
  {
    itemCode: "700402",
    itemName: "Vitamin B Complex 30 tabs",
    stdPrice: 180,
    promoPrice: 159,
    promoStart: new Date("2026-01-01"),
    promoEnd: new Date("2026-06-30"),
  },
  {
    itemCode: "700403",
    itemName: "Multivitamin 60 tabs",
    stdPrice: 350,
    promoPrice: 299,
    promoStart: new Date("2026-01-01"),
    promoEnd: new Date("2026-06-30"),
  },
  {
    itemCode: "800501",
    itemName: "Protein Powder Vanilla 500g",
    stdPrice: 450,
    promoPrice: null,
    promoStart: null,
    promoEnd: null,
  },
  {
    itemCode: "800502",
    itemName: "Protein Powder Chocolate 500g",
    stdPrice: 450,
    promoPrice: 399,
    promoStart: new Date("2026-02-01"),
    promoEnd: new Date("2026-03-31"),
  },
  {
    itemCode: "800503",
    itemName: "Protein Powder Strawberry 500g",
    stdPrice: 450,
    promoPrice: 399,
    promoStart: new Date("2026-02-01"),
    promoEnd: new Date("2026-03-31"),
  },
  {
    itemCode: "900601",
    itemName: "Yogurt Plain 150g",
    stdPrice: 20,
    promoPrice: 15,
    promoStart: new Date("2026-02-01"),
    promoEnd: new Date("2026-02-28"),
  },
  {
    itemCode: "900602",
    itemName: "Yogurt Strawberry 150g",
    stdPrice: 22,
    promoPrice: 18,
    promoStart: new Date("2026-02-01"),
    promoEnd: new Date("2026-02-28"),
  },
  {
    itemCode: "900603",
    itemName: "Yogurt Blueberry 150g",
    stdPrice: 22,
    promoPrice: 18,
    promoStart: new Date("2026-02-01"),
    promoEnd: new Date("2026-02-28"),
  },
  {
    itemCode: "101701",
    itemName: "Green Tea 500ml",
    stdPrice: 25,
    promoPrice: 20,
    promoStart: new Date("2026-01-01"),
    promoEnd: new Date("2026-12-31"),
  },
  {
    itemCode: "101702",
    itemName: "Oolong Tea 500ml",
    stdPrice: 28,
    promoPrice: 23,
    promoStart: new Date("2026-01-01"),
    promoEnd: new Date("2026-12-31"),
  },
  {
    itemCode: "101703",
    itemName: "Black Tea 500ml",
    stdPrice: 25,
    promoPrice: null,
    promoStart: null,
    promoEnd: null,
  },
  {
    itemCode: "111801",
    itemName: "Cookies Original 100g",
    stdPrice: 35,
    promoPrice: 29,
    promoStart: new Date("2026-02-14"),
    promoEnd: new Date("2026-02-28"),
  },
  {
    itemCode: "111802",
    itemName: "Cookies Chocolate 100g",
    stdPrice: 38,
    promoPrice: 32,
    promoStart: new Date("2026-02-14"),
    promoEnd: new Date("2026-02-28"),
  },
  {
    itemCode: "111803",
    itemName: "Cookies Butter 100g",
    stdPrice: 35,
    promoPrice: null,
    promoStart: null,
    promoEnd: null,
  },
  {
    itemCode: "121901",
    itemName: "Cereal Oats 400g",
    stdPrice: 89,
    promoPrice: 75,
    promoStart: new Date("2026-01-01"),
    promoEnd: new Date("2026-03-31"),
  },
  {
    itemCode: "121902",
    itemName: "Cereal Corn Flakes 400g",
    stdPrice: 79,
    promoPrice: 65,
    promoStart: new Date("2026-01-01"),
    promoEnd: new Date("2026-03-31"),
  },
  {
    itemCode: "121903",
    itemName: "Cereal Granola 350g",
    stdPrice: 120,
    promoPrice: 99,
    promoStart: new Date("2026-01-01"),
    promoEnd: new Date("2026-03-31"),
  },
  {
    itemCode: "132001",
    itemName: "Juice Orange 1L",
    stdPrice: 55,
    promoPrice: 45,
    promoStart: new Date("2026-02-01"),
    promoEnd: new Date("2026-02-28"),
  },
  {
    itemCode: "132002",
    itemName: "Juice Apple 1L",
    stdPrice: 55,
    promoPrice: 45,
    promoStart: new Date("2026-02-01"),
    promoEnd: new Date("2026-02-28"),
  },
  {
    itemCode: "132003",
    itemName: "Juice Mixed Berry 1L",
    stdPrice: 60,
    promoPrice: 50,
    promoStart: new Date("2026-02-01"),
    promoEnd: new Date("2026-02-28"),
  },
  {
    itemCode: "142101",
    itemName: "Coffee Instant 200g",
    stdPrice: 120,
    promoPrice: null,
    promoStart: null,
    promoEnd: null,
  },
  {
    itemCode: "142102",
    itemName: "Coffee 3in1 30 sachets",
    stdPrice: 150,
    promoPrice: 129,
    promoStart: new Date("2026-01-15"),
    promoEnd: new Date("2026-04-30"),
  },
  {
    itemCode: "142103",
    itemName: "Coffee Ground 250g",
    stdPrice: 180,
    promoPrice: 159,
    promoStart: new Date("2026-01-15"),
    promoEnd: new Date("2026-04-30"),
  },
  {
    itemCode: "152201",
    itemName: "Honey Pure 500g",
    stdPrice: 220,
    promoPrice: 189,
    promoStart: new Date("2026-02-01"),
    promoEnd: new Date("2026-03-31"),
  },
  {
    itemCode: "152202",
    itemName: "Honey Manuka 250g",
    stdPrice: 890,
    promoPrice: null,
    promoStart: null,
    promoEnd: null,
  },
  {
    itemCode: "162301",
    itemName: "Nuts Mixed 200g",
    stdPrice: 150,
    promoPrice: 129,
    promoStart: new Date("2026-01-01"),
    promoEnd: new Date("2026-02-28"),
  },
  {
    itemCode: "162302",
    itemName: "Almonds Raw 200g",
    stdPrice: 180,
    promoPrice: 159,
    promoStart: new Date("2026-01-01"),
    promoEnd: new Date("2026-02-28"),
  },
  {
    itemCode: "162303",
    itemName: "Cashews Roasted 200g",
    stdPrice: 160,
    promoPrice: 139,
    promoStart: new Date("2026-01-01"),
    promoEnd: new Date("2026-02-28"),
  },
];
