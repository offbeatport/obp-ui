export type RiskSignal = {
  label: string;
  severity: "high" | "medium" | "low";
};

export type Message = {
  from: "agent" | "buyer";
  text: string;
  time: string;
};

export type Order = {
  id: string;
  product: { name: string; sku: string; category: string; color: string };
  buyer: { name: string; email: string; isFirstTime: boolean };
  value: number;
  riskScore: number;
  riskSignals: RiskSignal[];
  status: "watching" | "intervening" | "resolved" | "kept" | "cancelled";
  outcome: "kept" | "size_swapped" | "cancelled" | "awaiting" | null;
  placedAt: string;
  intervention: {
    channel: "sms" | "email";
    sentAt: string;
    messages: Message[];
  } | null;
};

export const ORDERS: Order[] = [
  {
    id: "4821",
    product: { name: "Oversized Linen Blazer", sku: "BLZ-LIN-M", category: "Apparel", color: "#8B7355" },
    buyer: { name: "Sarah K.", email: "s****@gmail.com", isFirstTime: true },
    value: 189,
    riskScore: 96,
    riskSignals: [
      { label: "Ordered S, M & L - bracketing detected", severity: "high" },
      { label: "First-time buyer", severity: "high" },
      { label: "Purchase at 11:42 PM", severity: "medium" },
      { label: "High-return SKU (31% rate)", severity: "medium" },
    ],
    status: "resolved",
    outcome: "size_swapped",
    placedAt: "2 min ago",
    intervention: {
      channel: "sms",
      sentAt: "11:44 PM",
      messages: [
        {
          from: "agent",
          text: "Hey Sarah! Quick note before we ship your Linen Blazer - looks like you ordered S, M, and L. This style runs true to size. Which fit are you aiming for? We can ship just one and sort the rest right now 😊",
          time: "11:44 PM",
        },
        {
          from: "buyer",
          text: "Oh wow I didn't even realise! I usually wear M. Can you just send the M?",
          time: "11:47 PM",
        },
        {
          from: "agent",
          text: "Done! Updated to Medium only and refunded S and L. Your blazer ships tomorrow morning. You're going to love it 🎉",
          time: "11:47 PM",
        },
      ],
    },
  },
  {
    id: "4820",
    product: { name: "Air Trainer Pro - US 9", sku: "SHO-ATP-9", category: "Footwear", color: "#3B5BDB" },
    buyer: { name: "James R.", email: "j****@icloud.com", isFirstTime: true },
    value: 142,
    riskScore: 88,
    riskSignals: [
      { label: "First-time buyer", severity: "high" },
      { label: "Footwear - highest return category", severity: "high" },
      { label: "Size at boundary of stock (US 9 = last unit)", severity: "medium" },
    ],
    status: "intervening",
    outcome: "awaiting",
    placedAt: "8 min ago",
    intervention: {
      channel: "sms",
      sentAt: "Just now",
      messages: [
        {
          from: "agent",
          text: "Hey James! Heads up before we ship your Air Trainer Pros - these run a half size small. Most customers your size go up to US 9.5. Want us to check stock in 9.5 before we send these out?",
          time: "Just now",
        },
      ],
    },
  },
  {
    id: "4819",
    product: { name: "Cashmere Crew Neck", sku: "KNT-CSH-S", category: "Apparel", color: "#6B7280" },
    buyer: { name: "Emma T.", email: "e****@me.com", isFirstTime: false },
    value: 220,
    riskScore: 79,
    riskSignals: [
      { label: "Ship-to ≠ billing address - gift detected", severity: "high" },
      { label: "No gift note added", severity: "medium" },
      { label: "High AOV vs. buyer average ($94)", severity: "low" },
    ],
    status: "resolved",
    outcome: "kept",
    placedAt: "24 min ago",
    intervention: {
      channel: "email",
      sentAt: "22 min ago",
      messages: [
        {
          from: "agent",
          text: "Hi Emma! Looks like your Cashmere Crew Neck is heading to a different address - is this a gift? We can add a personal note and double-check delivery details before it ships.",
          time: "9:18 AM",
        },
        {
          from: "buyer",
          text: "Yes! It's for my mum's birthday. Can you add 'Happy Birthday Mum, love Emma' please?",
          time: "9:21 AM",
        },
        {
          from: "agent",
          text: "Added! Gift note is on and we've confirmed the delivery address with your mum's postcode. It ships today 💛",
          time: "9:21 AM",
        },
      ],
    },
  },
  {
    id: "4818",
    product: { name: "Wide-Leg Denim - 28W", sku: "DNM-WL-28", category: "Apparel", color: "#1E3A5F" },
    buyer: { name: "Priya M.", email: "p****@gmail.com", isFirstTime: true },
    value: 98,
    riskScore: 74,
    riskSignals: [
      { label: "Order completed in 38 seconds - impulse buy", severity: "high" },
      { label: "First-time buyer", severity: "high" },
      { label: "Purchase at 1:12 AM", severity: "medium" },
    ],
    status: "intervening",
    outcome: "awaiting",
    placedAt: "1 hr ago",
    intervention: {
      channel: "sms",
      sentAt: "55 min ago",
      messages: [
        {
          from: "agent",
          text: "Hey Priya! Your Wide-Leg Denim order is confirmed 🎉 We hold orders for 2 hours before processing - if anything changes just reply CHANGE and we'll sort it. Otherwise we'll get them on their way!",
          time: "1:14 AM",
        },
      ],
    },
  },
  {
    id: "4817",
    product: { name: "Ribbed Tank Set - M", sku: "SET-RIB-M", category: "Apparel", color: "#F4A261" },
    buyer: { name: "Lucia B.", email: "l****@outlook.com", isFirstTime: true },
    value: 65,
    riskScore: 71,
    riskSignals: [
      { label: "First-time buyer", severity: "high" },
      { label: "SKU has 28% return rate", severity: "medium" },
      { label: "No previous purchase to calibrate sizing", severity: "low" },
    ],
    status: "resolved",
    outcome: "kept",
    placedAt: "2 hrs ago",
    intervention: {
      channel: "sms",
      sentAt: "1 hr 55 min ago",
      messages: [
        {
          from: "agent",
          text: "Hi Lucia! Quick note on your Ribbed Tank Set - the top runs slightly cropped and the shorts fit true to size. If you prefer a longer top, a size up might work better. Happy to swap before we ship!",
          time: "10:05 AM",
        },
        {
          from: "buyer",
          text: "No I love a crop top! M is perfect, thank you for checking 😊",
          time: "10:09 AM",
        },
        {
          from: "agent",
          text: "Perfect! Confirmed as Medium. Ships today 📦",
          time: "10:09 AM",
        },
      ],
    },
  },
  {
    id: "4816",
    product: { name: "Structured Tote - Tan", sku: "BAG-TOT-TAN", category: "Accessories", color: "#A0785A" },
    buyer: { name: "Marcus W.", email: "m****@gmail.com", isFirstTime: false },
    value: 310,
    riskScore: 22,
    riskSignals: [
      { label: "Repeat buyer (4 orders, 0 returns)", severity: "low" },
    ],
    status: "watching",
    outcome: null,
    placedAt: "3 hrs ago",
    intervention: null,
  },
  {
    id: "4815",
    product: { name: "Silk Slip Dress - S", sku: "DRS-SLK-S", category: "Apparel", color: "#E8B4CB" },
    buyer: { name: "Chloe F.", email: "c****@yahoo.com", isFirstTime: false },
    value: 175,
    riskScore: 91,
    riskSignals: [
      { label: "Buyer returned 3 of last 4 orders", severity: "high" },
      { label: "SKU has 38% return rate", severity: "high" },
      { label: "Ordered same dress in black last month - returned it", severity: "medium" },
    ],
    status: "resolved",
    outcome: "cancelled",
    placedAt: "4 hrs ago",
    intervention: {
      channel: "sms",
      sentAt: "3 hrs 55 min ago",
      messages: [
        {
          from: "agent",
          text: "Hey Chloe! We noticed you loved the style of the Silk Slip in black last month - can we ask what wasn't quite right? We want to make sure this ivory one is perfect before it ships.",
          time: "8:05 AM",
        },
        {
          from: "buyer",
          text: "Honestly the fabric was a bit thinner than I expected. I was hoping this colour might be different but maybe not worth it",
          time: "8:14 AM",
        },
        {
          from: "agent",
          text: "Thank you for being honest! The ivory uses the same fabric. I've gone ahead and cancelled the order - no charge at all. Can I suggest our Satin Midi instead? Same look, heavier fabric and it's stunning.",
          time: "8:14 AM",
        },
        {
          from: "buyer",
          text: "Oh yes please send me the link!",
          time: "8:16 AM",
        },
      ],
    },
  },
  {
    id: "4814",
    product: { name: "Arc Pendant Light", sku: "LGT-ARC-BLK", category: "Home", color: "#1C1C1C" },
    buyer: { name: "Tom A.", email: "t****@gmail.com", isFirstTime: true },
    value: 249,
    riskScore: 58,
    riskSignals: [
      { label: "First-time buyer", severity: "high" },
      { label: "High AOV purchase", severity: "medium" },
      { label: "Colour listed as 'Matte Black' - photos show warm bronze", severity: "medium" },
    ],
    status: "resolved",
    outcome: "kept",
    placedAt: "5 hrs ago",
    intervention: {
      channel: "email",
      sentAt: "4 hrs 55 min ago",
      messages: [
        {
          from: "agent",
          text: "Hi Tom! Just a heads up on your Arc Pendant - the product is listed as 'Matte Black' but has warm bronze undertones in person (our photos don't capture it perfectly). Wanted to flag before it ships so there are no surprises!",
          time: "7:05 AM",
        },
        {
          from: "buyer",
          text: "Oh actually that sounds even better! I wanted something warmer. Thanks for letting me know.",
          time: "7:22 AM",
        },
        {
          from: "agent",
          text: "Great - you're going to love it. Confirmed and ships today! 🙌",
          time: "7:22 AM",
        },
      ],
    },
  },
];

export const CHART_DATA = [
  28.4, 27.1, 29.2, 28.8, 27.5, 26.9, 28.1, 27.8, 29.0, 28.3,
  27.6, 28.9, 27.2, 28.5, 26.8,
  // PreventReturn turned on - day 16
  22.1, 19.4, 17.8, 16.2, 15.1, 14.3, 13.8, 13.2, 12.8, 12.4,
  12.1, 11.8, 11.5, 11.3, 11.2,
];

export const METRICS = {
  returnRate: { current: 11.2, previous: 28.4 },
  ordersMonitored: 1247,
  interventionsSent: 89,
  savedDollars: 14820,
  preventedReturns: 67,
};
