import "server-only";
import { cookies } from "next/headers";

/**
 * Lightweight cookie-based localisation for the PUBLIC site. A `locale` cookie
 * ("en" | "am") selects the dictionary; the language switcher sets it and
 * refreshes. Amharic strings are written as whole, natural sentences (not
 * word-for-word) so each paragraph reads correctly and matches the English
 * meaning.
 */
export type Locale = "en" | "am";
export const LOCALES: Locale[] = ["en", "am"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

const en = {
  code: "en" as Locale,
  // Label shown on the switcher = the OTHER language you can switch to.
  switchLabel: "አማርኛ",
  htmlLang: "en",

  nav: {
    campaigns: "Campaigns",
    start: "Start a campaign",
    support: "Support",
    signIn: "Sign in",
    signOut: "Sign out",
    dashboard: "Dashboard",
    adminPanel: "Admin panel",
  },

  footer: {
    blurb:
      "A verified crowdfunding platform. Every campaign is identity-checked, every donation is tracked, and every payout is audited.",
    platform: "Platform",
    legal: "Legal",
    help: "Help",
    browse: "Browse campaigns",
    blog: "Blog",
    support: "Support",
    terms: "Terms & conditions",
    privacy: "Privacy policy",
    fees: "Fees & payouts",
    faq: "FAQ",
    contact: "Contact us",
    ownerQ: "Are you a campaign owner?",
    ownerSub:
      "Sign in to manage your campaigns, or get verified to start raising funds.",
    registerOwner: "Register as a campaign owner",
    rights: "All rights reserved.",
    builtBy: "Designed & built by",
  },

  trust: {
    verified: "Verified campaigns",
    payments: "Local & international payments",
    secure: "Secure checkout",
  },

  home: {
    activeTitle: "Active campaigns",
    activeSub:
      "Verified causes raising funds right now — every owner is identity-checked and every payout is audited.",
    viewAll: "View all campaigns",
    empty: "No active campaigns yet — please check back soon.",
    trustTitle: "Built for trust, end to end",
    trustSub: "No mixed funds. No anonymous campaigns. No unverified payouts.",
    pillars: {
      verifiedOwners: "Verified owners",
      verifiedOwnersDesc:
        "Every campaign owner passes ID checks, live face verification, and manual review before going live.",
      oneCode: "One campaign, one code",
      oneCodeDesc:
        "Each campaign has its own querycode and QR. Your donation lands on exactly one campaign — never a shared pool.",
      ledgers: "Separated ledgers",
      ledgersDesc:
        "Funds are never mixed. Each campaign has its own donation ledger and audited payout record.",
      instant: "Instant confirmation",
      instantDesc:
        "Payments are confirmed by the payment gateway before they count, and owners are alerted in real time.",
    },
  },

  list: {
    title: "Campaigns",
    subtitle: "Verified causes from around the world — each one identity-checked and separately tracked.",
    all: "All",
    search: "Search campaigns…",
    empty: "No campaigns match your filters yet.",
  },

  campaign: {
    active: "Active",
    fullyFunded: "Fully funded",
    launched: "Launched",
    goal: "Goal",
    verified: "Verified",
    by: "by",
    verifiedOwner: "Verified owner",
    theStory: "The story",
    updates: "Updates",
    viewAll: "View all",
    noUpdates: "No updates yet. The owner will post progress here.",
    raisedOfGoal: "raised of {goal} goal",
    supporters: "Supporters",
    stillNeeded: "Still needed",
    donate: "Donate securely",
    secureLine: "Secure checkout · funds isolated to this campaign",
    feeApplies: "A 3% platform fee applies.",
    fees: "Fees & payouts",
    terms: "Terms",
    querycode: "Campaign querycode",
    querycodeHint:
      "Scan or enter this code to donate to this exact campaign — it never points anywhere else.",
    quickDonate: "Quick donate",
    reviewedLabel: "Reviewed",
    ownerCodeLabel: "Owner code",
    report: "Report this campaign",
    funded: "funded",
    onlyThis: "This code funds only this campaign — never a shared pool.",
    seeFull: "See full campaign",
  },

  donate: {
    back: "Back to campaign",
    title: "Make a donation",
    isolated: "Your gift is isolated to this campaign — funds are never pooled.",
    closed:
      "This campaign is fully funded and no longer accepting donations. Thank you to everyone who contributed!",
    secureFee: "Secure checkout · a 3% platform fee applies ·",
  },

  categories: {
    MEDICAL: "Medical",
    EDUCATION: "Education",
    COMMUNITY: "Community",
    BUSINESS: "Business",
    EMERGENCY: "Emergency",
    OTHER: "Other",
  },
};

export type Dict = typeof en;

const am: Dict = {
  code: "am",
  switchLabel: "English",
  htmlLang: "am",

  nav: {
    campaigns: "ዘመቻዎች",
    start: "ዘመቻ ጀምር",
    support: "ድጋፍ",
    signIn: "ግባ",
    signOut: "ውጣ",
    dashboard: "ዳሽቦርድ",
    adminPanel: "የአስተዳዳሪ ክፍል",
  },

  footer: {
    blurb:
      "የተረጋገጠ የገንዘብ ማሰባሰቢያ መድረክ ነው። እያንዳንዱ ዘመቻ ማንነቱ ይረጋገጣል፣ እያንዳንዱ ልገሳ ይከታተላል፣ እያንዳንዱም ክፍያ ይመረመራል።",
    platform: "መድረክ",
    legal: "ሕጋዊ",
    help: "እገዛ",
    browse: "ዘመቻዎችን ያስሱ",
    blog: "ብሎግ",
    support: "ድጋፍ",
    terms: "የአጠቃቀም ውሎችና ሁኔታዎች",
    privacy: "የግላዊነት ፖሊሲ",
    fees: "ክፍያዎችና ወጪዎች",
    faq: "ተደጋጋሚ ጥያቄዎች",
    contact: "ያግኙን",
    ownerQ: "የዘመቻ አዘጋጅ ነዎት?",
    ownerSub:
      "ዘመቻዎችዎን ለማስተዳደር ይግቡ፣ ወይም ገንዘብ ማሰባሰብ ለመጀመር ማንነትዎን ያረጋግጡ።",
    registerOwner: "እንደ ዘመቻ አዘጋጅ ይመዝገቡ",
    rights: "መብቱ በሕግ የተጠበቀ ነው።",
    builtBy: "ተነድፎና ተገንብቷል በ",
  },

  trust: {
    verified: "የተረጋገጡ ዘመቻዎች",
    payments: "የአገር ውስጥና ዓለም አቀፍ ክፍያዎች",
    secure: "ደህንነቱ የተጠበቀ ክፍያ",
  },

  home: {
    activeTitle: "ንቁ ዘመቻዎች",
    activeSub:
      "አሁን ገንዘብ እያሰባሰቡ ያሉ የተረጋገጡ ዓላማዎች — የእያንዳንዱ አዘጋጅ ማንነት ተረጋግጧል፣ እያንዳንዱም ክፍያ ተመርምሯል።",
    viewAll: "ሁሉንም ዘመቻዎች ይመልከቱ",
    empty: "እስካሁን ንቁ ዘመቻ የለም — እባክዎ ቆየት ብለው እንደገና ይመልከቱ።",
    trustTitle: "ከመጀመሪያው እስከ መጨረሻው ለመተማመን የተገነባ",
    trustSub:
      "የተቀላቀለ ገንዘብ የለም። ማንነታቸው የማይታወቅ ዘመቻዎች የሉም። ያልተረጋገጡ ክፍያዎችም የሉም።",
    pillars: {
      verifiedOwners: "የተረጋገጡ አዘጋጆች",
      verifiedOwnersDesc:
        "እያንዳንዱ የዘመቻ አዘጋጅ ዘመቻው ከመጀመሩ በፊት የማንነት ማረጋገጫ፣ የቀጥታ የፊት ማረጋገጫና በሰው የሚደረግ ግምገማ ያልፋል።",
      oneCode: "አንድ ዘመቻ፣ አንድ ኮድ",
      oneCodeDesc:
        "እያንዳንዱ ዘመቻ የራሱ የመለያ ኮድና QR አለው። ልገሳዎ በትክክል ወደ አንድ ዘመቻ ብቻ ይደርሳል — ወደ ጋራ ገንዘብ ፈጽሞ አይገባም።",
      ledgers: "የተለያዩ የሂሳብ መዝገቦች",
      ledgersDesc:
        "ገንዘቦች ፈጽሞ አይቀላቀሉም። እያንዳንዱ ዘመቻ የራሱ የልገሳ መዝገብና የተመረመረ የክፍያ መዝገብ አለው።",
      instant: "ፈጣን ማረጋገጫ",
      instantDesc:
        "ክፍያዎች ከመቆጠራቸው በፊት በክፍያ አገልግሎቱ ይረጋገጣሉ፣ አዘጋጆችም ወዲያውኑ ማሳወቂያ ይደርሳቸዋል።",
    },
  },

  list: {
    title: "ዘመቻዎች",
    subtitle: "ከመላው ዓለም የተውጣጡ የተረጋገጡ ዓላማዎች — እያንዳንዳቸው ማንነታቸው ተረጋግጦ በተናጠል ይከታተላሉ።",
    all: "ሁሉም",
    search: "ዘመቻዎችን ይፈልጉ…",
    empty: "ከማጣሪያዎችዎ ጋር የሚዛመድ ዘመቻ እስካሁን የለም።",
  },

  campaign: {
    active: "ንቁ",
    fullyFunded: "ሙሉ በሙሉ ተሸፍኗል",
    launched: "የተጀመረበት",
    goal: "ግብ",
    verified: "የተረጋገጠ",
    by: "በ",
    verifiedOwner: "የተረጋገጠ አዘጋጅ",
    theStory: "ታሪኩ",
    updates: "ዝማኔዎች",
    viewAll: "ሁሉንም ይመልከቱ",
    noUpdates: "እስካሁን ዝማኔ የለም። አዘጋጁ የሥራውን እድገት እዚህ ላይ ይለጥፋል።",
    raisedOfGoal: "ከ{goal} ግብ ውስጥ ተሰብስቧል",
    supporters: "ደጋፊዎች",
    stillNeeded: "ቀሪ የሚያስፈልግ",
    donate: "በደህንነት ይለግሱ",
    secureLine: "ደህንነቱ የተጠበቀ ክፍያ · ገንዘቡ ለዚህ ዘመቻ ብቻ ተለይቷል",
    feeApplies: "3% የመድረክ ክፍያ ይተገበራል።",
    fees: "ክፍያዎችና ወጪዎች",
    terms: "ውሎች",
    querycode: "የዘመቻ መለያ ኮድ",
    querycodeHint:
      "ለዚህ ዘመቻ ብቻ ለመለገስ ይህን ኮድ ይቃኙ ወይም ያስገቡ — ፈጽሞ ወደ ሌላ ቦታ አይመራም።",
    quickDonate: "ፈጣን ልገሳ",
    reviewedLabel: "ተገምግሟል",
    ownerCodeLabel: "የአዘጋጅ ኮድ",
    report: "ይህን ዘመቻ ሪፖርት ያድርጉ",
    funded: "ተሸፍኗል",
    onlyThis: "ይህ ኮድ ለዚህ ዘመቻ ብቻ ገንዘብ ያሰባስባል — ፈጽሞ ወደ ጋራ ገንዘብ አይገባም።",
    seeFull: "ሙሉ ዘመቻውን ይመልከቱ",
  },

  donate: {
    back: "ወደ ዘመቻው ተመለስ",
    title: "ልገሳ ያድርጉ",
    isolated: "ስጦታዎ ለዚህ ዘመቻ ብቻ የተለየ ነው — ገንዘቦች ፈጽሞ አይቀላቀሉም።",
    closed:
      "ይህ ዘመቻ ሙሉ በሙሉ ተሸፍኗል፤ ከእንግዲህ ልገሳ አይቀበልም። ላበረከታችሁ ሁሉ እናመሰግናለን!",
    secureFee: "ደህንነቱ የተጠበቀ ክፍያ · 3% የመድረክ ክፍያ ይተገበራል ·",
  },

  categories: {
    MEDICAL: "ሕክምና",
    EDUCATION: "ትምህርት",
    COMMUNITY: "ማህበረሰብ",
    BUSINESS: "ንግድ",
    EMERGENCY: "አደጋ ጊዜ",
    OTHER: "ሌላ",
  },
};

const dictionaries: Record<Locale, Dict> = { en, am };

/** Current locale from the cookie (defaults to English). */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return value === "am" ? "am" : "en";
}

/** The dictionary for the current locale. */
export async function getDictionary(): Promise<Dict> {
  return dictionaries[await getLocale()];
}
