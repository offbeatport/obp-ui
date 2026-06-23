import { db } from "../db/client";
import { categories, queries } from "../db/schema";

const SEED = [
  {
    name: "Skincare",
    slug: "skincare",
    queries: [
      "Where can I buy good skincare products online?",
      "What are the best online stores for skincare?",
      "Where should I shop for moisturizers and serums online?",
      "Best websites to buy skincare for sensitive skin?",
      "Where do people buy high quality skincare online?",
    ],
  },
  {
    name: "Hair Care",
    slug: "hair-care",
    queries: [
      "Where can I buy good hair care products online?",
      "Best online stores for shampoo and conditioner?",
      "Where should I buy hair treatments and masks online?",
      "What websites sell quality hair care products?",
      "Where do people shop for hair care online?",
    ],
  },
  {
    name: "Men's Grooming",
    slug: "mens-grooming",
    queries: [
      "Where can I buy men's grooming products online?",
      "Best online stores for beard care and shaving?",
      "Where should I buy aftershave and face wash for men online?",
      "What are good websites for men's skincare and grooming?",
      "Where do men shop for grooming products online?",
    ],
  },
  {
    name: "Supplements",
    slug: "supplements",
    queries: [
      "Where can I buy supplements and vitamins online?",
      "Best online stores for protein powder and creatine?",
      "Where should I buy pre-workout and fitness supplements online?",
      "What are good websites for buying vitamins online?",
      "Where do people buy supplements online?",
    ],
  },
  {
    name: "Coffee & Tea",
    slug: "coffee-tea",
    queries: [
      "Where can I buy specialty coffee online?",
      "Best websites to buy freshly roasted coffee beans?",
      "Where should I buy a coffee subscription online?",
      "What are good online stores for loose leaf tea?",
      "Where do coffee enthusiasts buy beans online?",
    ],
  },
  {
    name: "Food & Snacks",
    slug: "food-snacks",
    queries: [
      "Where can I buy specialty food and snacks online?",
      "Best online stores for healthy snacks?",
      "Where should I buy artisan food gifts online?",
      "What are good websites for buying unique snacks online?",
      "Where do people buy gourmet food online?",
    ],
  },
  {
    name: "Candles & Home Fragrance",
    slug: "candles",
    queries: [
      "Where can I buy good candles online?",
      "Best online stores for scented candles?",
      "Where should I buy luxury candles as a gift online?",
      "What are good websites for home fragrance and diffusers?",
      "Where do people buy nice candles online?",
    ],
  },
  {
    name: "Home Decor",
    slug: "home-decor",
    queries: [
      "Where can I buy home decor online?",
      "Best online stores for unique home accessories?",
      "Where should I shop for modern home decor online?",
      "What are good websites for affordable home decor?",
      "Where do people buy home decor online besides Amazon?",
    ],
  },
  {
    name: "Sneakers & Footwear",
    slug: "sneakers",
    queries: [
      "Where can I buy sneakers online?",
      "Best online stores for running shoes?",
      "Where should I buy boots and casual shoes online?",
      "What are good websites to buy premium sneakers?",
      "Where do people buy shoes online besides Amazon?",
    ],
  },
  {
    name: "Clothing & Apparel",
    slug: "clothing",
    queries: [
      "Where can I buy quality clothing online?",
      "Best online stores for everyday basics and t-shirts?",
      "Where should I shop for casual clothes online?",
      "What are good websites for affordable quality clothing?",
      "Where do people buy clothes online besides Amazon?",
    ],
  },
  {
    name: "Activewear",
    slug: "activewear",
    queries: [
      "Where can I buy gym and workout clothes online?",
      "Best online stores for activewear and leggings?",
      "Where should I buy running and training gear online?",
      "What are good websites for athletic clothing?",
      "Where do people buy workout clothes online besides Amazon?",
    ],
  },
  {
    name: "Bags & Accessories",
    slug: "bags-accessories",
    queries: [
      "Where can I buy a quality backpack or bag online?",
      "Best online stores for wallets and everyday carry?",
      "Where should I buy a leather bag or tote online?",
      "What are good websites for bags and accessories?",
      "Where do people buy bags online besides Amazon?",
    ],
  },
  {
    name: "Watches",
    slug: "watches",
    queries: [
      "Where can I buy a quality watch online?",
      "Best online stores for affordable premium watches?",
      "Where should I buy a men's watch online?",
      "What are good websites to buy watches directly from the brand?",
      "Where do people buy watches online besides Amazon?",
    ],
  },
  {
    name: "Outdoor & Camping",
    slug: "outdoor-camping",
    queries: [
      "Where can I buy camping gear online?",
      "Best online stores for hiking and outdoor equipment?",
      "Where should I buy a tent or sleeping bag online?",
      "What are good websites for outdoor adventure gear?",
      "Where do people buy camping supplies online besides Amazon?",
    ],
  },
  {
    name: "Tech Accessories",
    slug: "tech-accessories",
    queries: [
      "Where can I buy phone cases and tech accessories online?",
      "Best online stores for desk setup and office accessories?",
      "Where should I buy a quality phone case online?",
      "What are good websites for gadgets and tech accessories?",
      "Where do people buy tech accessories online besides Amazon?",
    ],
  },
  {
    name: "Jewelry",
    slug: "jewelry",
    queries: [
      "Where can I buy jewelry online?",
      "Best online stores for affordable fine jewelry?",
      "Where should I buy a necklace or ring as a gift online?",
      "What are good websites for gold and silver jewelry?",
      "Where do people buy jewelry online besides Amazon?",
    ],
  },
  {
    name: "Baby & Kids",
    slug: "baby-kids",
    queries: [
      "Where can I buy baby products online?",
      "Best online stores for kids toys and clothing?",
      "Where should I buy baby shower gifts online?",
      "What are good websites for toddler and children's products?",
      "Where do people buy baby stuff online besides Amazon?",
    ],
  },
  {
    name: "Stationery & Gifts",
    slug: "stationery-gifts",
    queries: [
      "Where can I buy unique gifts online?",
      "Best online stores for stationery and notebooks?",
      "Where should I buy a thoughtful gift for someone online?",
      "What are good websites for greeting cards and gift wrap?",
      "Where do people buy gifts online besides Amazon?",
    ],
  },
  {
    name: "Dog Supplies",
    slug: "dog-supplies",
    queries: [
      "Where can I buy dog food and treats online?",
      "Best online stores for dog accessories and toys?",
      "Where should I buy a dog collar or leash online?",
      "What are good websites for premium dog food?",
      "Where do people buy dog supplies online besides Chewy?",
    ],
  },
  {
    name: "Spirits & Cocktails",
    slug: "spirits-cocktails",
    queries: [
      "Where can I buy cocktail mixers and bitters online?",
      "Best online stores for craft spirits and liqueurs?",
      "Where should I buy home bartending supplies online?",
      "What are good websites for specialty cocktail ingredients?",
      "Where do people buy cocktail supplies online?",
    ],
  },
  {
    name: "Bedding & Towels",
    slug: "bedding-towels",
    queries: [
      "Where can I buy quality bed sheets online?",
      "Best online stores for luxury bedding and pillows?",
      "Where should I buy towels and bath linens online?",
      "What are good websites for premium sheets and duvet covers?",
      "Where do people buy bedding online besides Amazon?",
    ],
  },
];

export async function seedIfEmpty() {
  const existing = await db.select().from(categories).limit(1);
  if (existing.length > 0) return;

  for (const cat of SEED) {
    const [inserted] = await db
      .insert(categories)
      .values({ id: crypto.randomUUID(), name: cat.name, slug: cat.slug })
      .returning();
    for (const q of cat.queries) {
      await db.insert(queries).values({
        id: crypto.randomUUID(),
        categoryId: inserted.id,
        text: q,
      });
    }
  }
}
