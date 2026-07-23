/**
 * Client-safe localisation data for the PUBLIC site (no server-only imports so
 * client components can read it too). Server helpers live in `lib/i18n.ts`;
 * client components use the `useDict()` hook. Amharic strings are whole, natural
 * sentences — not word-for-word — so each reads correctly and matches English.
 */
export type Locale = "en" | "am";
export const LOCALES: Locale[] = ["en", "am"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

const en = {
  code: "en" as Locale,
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
    searchPlaceholder: "Search campaigns, causes, locations…",
    empty: "No campaigns match your filters yet.",
    sortNewest: "Newest",
    sortMostFunded: "Most funded",
    sortEndingSoon: "Ending soon",
    clear: "Clear",
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

  register: {
    ownerTitle: "Become a campaign owner",
    donorTitle: "Create your account",
    ownerDesc:
      "Step 1 of verification. After this you'll verify your phone & email, accept the terms, and upload your documents — all in one continuous flow.",
    donorDesc: "Donate to verified campaigns, or start your own",
    name: "Full name",
    email: "Email",
    phone: "Phone",
    optional: "(optional)",
    password: "Password",
    createContinue: "Create account & continue",
    create: "Create account",
    ownerNote:
      "You can only create campaigns after completing every verification step and being approved by an administrator.",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
    phoneRequired: "A phone number is required to become a campaign owner.",
    genericError: "Something went wrong. Please try again.",
    emailPlaceholder: "you@example.com",
    phonePlaceholder: "+1 555 123 4567 (any country)",
  },

  start: {
    badge: "For fundraisers (campaign owners)",
    title: "Are you a fundraiser?",
    introGuest:
      "Sign in if you already have an account, or register as a fundraiser to get verified. After you submit your documents, our team evaluates them within 24 hours and contacts you by email or phone — then you sign in and receive your Fundraiser ID.",
    introDonor:
      "Continue your verification. After you submit, our team evaluates everything within 24 hours and contacts you by email or phone — then you can receive your Fundraiser ID.",
    introOwner: "You're a verified fundraiser. Manage your campaigns from your dashboard.",
    introAdmin:
      "You're signed in as an administrator. To register as a fundraiser, sign out first, then choose “Register as fundraiser”.",
    registerFundraiser: "Register as fundraiser",
    signIn: "Sign in",
    continueVerification: "Continue verification",
    yourDashboard: "Your dashboard",
    goDashboard: "Go to your dashboard",
    goAdmin: "Go to admin panel",
    browse: "Browse campaigns",
    howTitle: "How verification works",
    howSub: "Six steps stand between an idea and a live, verified campaign.",
    needTitle: "What you'll need",
    needDesc:
      "Have these ready to move through verification quickly. Everything you upload is stored privately and seen only by authorised administrators.",
    needPrivate: "Documents are never shown publicly or shared.",
    readyTitle: "Ready to begin?",
    readyDesc:
      "Register as a fundraiser and continue straight through every verification step — email, terms, documents, and a live face check — then submit. Our team evaluates within 24 hours and contacts you.",
    steps: [
      { title: "Create your account", desc: "Sign up with your email and phone number, then verify both with a one-time code." },
      { title: "Accept terms & fees", desc: "Review and accept the platform terms, fee policy, and consent notices." },
      { title: "Upload your identity", desc: "Provide a national ID or passport, plus a supporting document for your cause." },
      { title: "Verify your face", desc: "Complete a quick live face capture so we can match it to your ID." },
      { title: "Admin review", desc: "Our team reviews your submission. This protects donors and keeps the platform trusted." },
      { title: "Launch your campaign", desc: "Once approved, you receive the Mulesoo seal and can create campaigns with their own querycodes." },
    ],
    requirements: [
      "National ID or passport",
      "Live face capture",
      "Payout account details",
      "Supporting document for your cause",
    ],
  },

  support: {
    eyebrow: "Support",
    title: "Help & legal centre",
    description:
      "Everything you need to understand how Yewogen Derash keeps fundraising transparent, verified, and safe.",
    readMore: "Read more",
    cards: {
      fees: { title: "Fees & payouts", desc: "How hosting and platform fees work, and when funds are paid out." },
      faq: { title: "FAQ", desc: "Common questions from donors and campaign owners." },
      terms: { title: "Terms & conditions", desc: "The rules that govern the use of Yewogen Derash." },
      privacy: { title: "Privacy policy", desc: "How we collect, use, and protect your personal and biometric data." },
      contact: { title: "Contact us", desc: "Reach the Yewogen Derash support team." },
      report: { title: "Report abuse", desc: "Flag a campaign or owner you believe is fraudulent." },
    },
  },

  blog: {
    title: "Blog",
    description: "Guides, platform updates, and stories about trusted fundraising worldwide.",
    empty: "No posts published yet — check back soon.",
  },

  wizard: {
    eyebrow: "Become a verified owner",
    title: "Owner verification",
    steps: {
      verify: "Verify contact",
      terms: "Terms & consent",
      documents: "Documents & payout",
      review: "Face & submit",
    },
    termsHeading: "Accept the terms",
    termsSub:
      "Before uploading any documents, please review and accept the following. Each acceptance is recorded with a timestamp.",
  },

  campaignForm: {
    writeHint:
      "You can write your campaign in Amharic or English — donors read it exactly as you write it.",
    title: "Campaign title",
    titleHint: "Clear and specific — no exaggerated claims.",
    category: "Category",
    target: "Target amount (ETB)",
    targetHint: "Whole birr, minimum 1,000.",
    location: "Location",
    locationHint: "City or region (optional).",
    locationPlaceholder: "e.g. Addis Ababa",
    endDate: "End date",
    endDateHint: "Optional — leave empty for open-ended.",
    summary: "Short summary",
    summaryHint: "Shown on campaign cards. 40–300 characters.",
    story: "Full story",
    storyHint:
      "The complete picture: who, why, what the funds cover, and how progress will be shared. Reviewers check this against your supporting documents.",
    currentHero: "Current hero image",
    currentHeroHint: "Upload a new image below to replace it, or leave empty to keep it.",
    heroReplace: "Replace hero image (optional)",
    heroOptional: "Hero image (optional)",
    uploadProof: "Upload proof document",
    createDraft: "Create draft",
    footerNote:
      "Your campaign is created as a draft. Submit it for review when ready — it goes live only after admin approval.",
    saveChanges: "Save changes",
    editFooterNote: "Changes are saved immediately and recorded in the audit log.",
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
    searchPlaceholder: "ዘመቻዎችን፣ ዓላማዎችን ወይም ቦታዎችን ይፈልጉ…",
    empty: "ከማጣሪያዎችዎ ጋር የሚዛመድ ዘመቻ እስካሁን የለም።",
    sortNewest: "አዲስ",
    sortMostFunded: "ብዙ የተሰበሰበ",
    sortEndingSoon: "በቅርቡ የሚያበቃ",
    clear: "አጽዳ",
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

  register: {
    ownerTitle: "የዘመቻ አዘጋጅ ይሁኑ",
    donorTitle: "መለያዎን ይፍጠሩ",
    ownerDesc:
      "የማረጋገጫ 1ኛ ደረጃ። ከዚህ በኋላ ስልክዎንና ኢሜይልዎን ያረጋግጣሉ፣ ውሎቹን ይቀበላሉ፣ ሰነዶችዎንም ይጭናሉ — ሁሉም በአንድ ተከታታይ ሂደት ውስጥ።",
    donorDesc: "ለተረጋገጡ ዘመቻዎች ይለግሱ፣ ወይም የራስዎን ይጀምሩ",
    name: "ሙሉ ስም",
    email: "ኢሜይል",
    phone: "ስልክ",
    optional: "(አማራጭ)",
    password: "የይለፍ ቃል",
    createContinue: "መለያ ፍጠርና ቀጥል",
    create: "መለያ ፍጠር",
    ownerNote:
      "ሁሉንም የማረጋገጫ ደረጃዎች አጠናቀው በአስተዳዳሪ ከጸደቁ በኋላ ብቻ ዘመቻ መፍጠር ይችላሉ።",
    haveAccount: "አስቀድሞ መለያ አለዎት?",
    signIn: "ይግቡ",
    phoneRequired: "የዘመቻ አዘጋጅ ለመሆን ስልክ ቁጥር ያስፈልጋል።",
    genericError: "የሆነ ስህተት ተከስቷል። እባክዎ እንደገና ይሞክሩ።",
    emailPlaceholder: "you@example.com",
    phonePlaceholder: "+251 91 234 5678 (ማንኛውም አገር)",
  },

  start: {
    badge: "ለዘመቻ አዘጋጆች",
    title: "ዘመቻ አዘጋጅ ነዎት?",
    introGuest:
      "አስቀድሞ መለያ ካለዎት ይግቡ፣ ወይም ለመረጋገጥ እንደ ዘመቻ አዘጋጅ ይመዝገቡ። ሰነዶችዎን ካስገቡ በኋላ ቡድናችን በ24 ሰዓት ውስጥ ገምግሞ በኢሜይል ወይም በስልክ ያገኝዎታል — ከዚያም ገብተው የአዘጋጅ መታወቂያዎን ይቀበላሉ።",
    introDonor:
      "ማረጋገጫዎን ይቀጥሉ። ካስገቡ በኋላ ቡድናችን ሁሉንም በ24 ሰዓት ውስጥ ገምግሞ በኢሜይል ወይም በስልክ ያገኝዎታል — ከዚያም የአዘጋጅ መታወቂያዎን መቀበል ይችላሉ።",
    introOwner: "የተረጋገጡ ዘመቻ አዘጋጅ ነዎት። ዘመቻዎችዎን ከዳሽቦርድዎ ያስተዳድሩ።",
    introAdmin:
      "እንደ አስተዳዳሪ ገብተዋል። እንደ ዘመቻ አዘጋጅ ለመመዝገብ በመጀመሪያ ይውጡ፣ ከዚያም “እንደ አዘጋጅ ይመዝገቡ”ን ይምረጡ።",
    registerFundraiser: "እንደ አዘጋጅ ይመዝገቡ",
    signIn: "ይግቡ",
    continueVerification: "ማረጋገጫ ይቀጥሉ",
    yourDashboard: "የእርስዎ ዳሽቦርድ",
    goDashboard: "ወደ ዳሽቦርድዎ ይሂዱ",
    goAdmin: "ወደ አስተዳዳሪ ክፍል ይሂዱ",
    browse: "ዘመቻዎችን ያስሱ",
    howTitle: "ማረጋገጫው እንዴት እንደሚሠራ",
    howSub: "ከሐሳብ እስከ ቀጥታ የተረጋገጠ ዘመቻ መካከል ስድስት ደረጃዎች አሉ።",
    needTitle: "የሚያስፈልግዎት ነገር",
    needDesc:
      "ማረጋገጫውን በፍጥነት ለማለፍ እነዚህን ዝግጁ ያድርጉ። የሚጭኑት ሁሉ በግል ተጠብቆ የሚቀመጥ ሲሆን በተፈቀደላቸው አስተዳዳሪዎች ብቻ ይታያል።",
    needPrivate: "ሰነዶች ፈጽሞ በይፋ አይታዩም ወይም አይጋሩም።",
    readyTitle: "ለመጀመር ዝግጁ ነዎት?",
    readyDesc:
      "እንደ ዘመቻ አዘጋጅ ይመዝገቡና ሁሉንም የማረጋገጫ ደረጃዎች — ኢሜይል፣ ውሎች፣ ሰነዶችና የቀጥታ የፊት ማረጋገጫ — በቀጥታ ያልፉ፣ ከዚያም ያስገቡ። ቡድናችን በ24 ሰዓት ውስጥ ገምግሞ ያገኝዎታል።",
    steps: [
      { title: "መለያዎን ይፍጠሩ", desc: "በኢሜይልዎና በስልክ ቁጥርዎ ይመዝገቡ፣ ከዚያም ሁለቱንም ባንድ ጊዜ በሚላክ ኮድ ያረጋግጡ።" },
      { title: "ውሎችና ክፍያዎችን ይቀበሉ", desc: "የመድረኩን ውሎች፣ የክፍያ ፖሊሲና የስምምነት ማሳወቂያዎችን ገምግመው ይቀበሉ።" },
      { title: "ማንነትዎን ይጫኑ", desc: "ብሔራዊ መታወቂያ ወይም ፓስፖርት፣ እንዲሁም ለዓላማዎ ማስረጃ ሰነድ ያቅርቡ።" },
      { title: "ፊትዎን ያረጋግጡ", desc: "ከመታወቂያዎ ጋር እንዲዛመድ ፈጣን የቀጥታ የፊት ቀረጻ ያድርጉ።" },
      { title: "የአስተዳዳሪ ግምገማ", desc: "ቡድናችን ማመልከቻዎን ይገመግማል። ይህ ለጋሾችን ይጠብቃል፣ መድረኩንም የታመነ ያደርገዋል።" },
      { title: "ዘመቻዎን ያስጀምሩ", desc: "ከጸደቁ በኋላ የሙሌሶ ማህተም ይቀበላሉ፣ የየራሳቸው መለያ ኮድ ያላቸው ዘመቻዎችን መፍጠር ይችላሉ።" },
    ],
    requirements: [
      "ብሔራዊ መታወቂያ ወይም ፓስፖርት",
      "የቀጥታ የፊት ቀረጻ",
      "የክፍያ መቀበያ መለያ ዝርዝሮች",
      "ለዓላማዎ ማስረጃ ሰነድ",
    ],
  },

  support: {
    eyebrow: "ድጋፍ",
    title: "የእገዛና ሕጋዊ ማዕከል",
    description:
      "ወገን ደራሽ የገንዘብ ማሰባሰብን ግልጽ፣ የተረጋገጠና ደህንነቱ የተጠበቀ እንዴት እንደሚያደርግ ለመረዳት የሚያስፈልግዎ ሁሉ።",
    readMore: "ተጨማሪ ያንብቡ",
    cards: {
      fees: { title: "ክፍያዎችና ወጪዎች", desc: "የማስተናገጃና የመድረክ ክፍያዎች እንዴት እንደሚሠሩ፣ ገንዘብም መቼ እንደሚከፈል።" },
      faq: { title: "ተደጋጋሚ ጥያቄዎች", desc: "ከለጋሾችና ከዘመቻ አዘጋጆች የሚነሱ የተለመዱ ጥያቄዎች።" },
      terms: { title: "ውሎችና ሁኔታዎች", desc: "የወገን ደራሽን አጠቃቀም የሚገዙ ደንቦች።" },
      privacy: { title: "የግላዊነት ፖሊሲ", desc: "የግልዎንና የባዮሜትሪክ መረጃዎን እንዴት እንደምንሰበስብ፣ እንደምንጠቀምና እንደምንጠብቅ።" },
      contact: { title: "ያግኙን", desc: "የወገን ደራሽ የድጋፍ ቡድንን ያግኙ።" },
      report: { title: "በደል ሪፖርት ያድርጉ", desc: "አጭበርባሪ ነው ብለው የሚያምኑበትን ዘመቻ ወይም አዘጋጅ ያመልክቱ።" },
    },
  },

  blog: {
    title: "ብሎግ",
    description: "ስለ ታመነ የገንዘብ ማሰባሰብ በዓለም አቀፍ ደረጃ መመሪያዎች፣ የመድረክ ዝማኔዎችና ታሪኮች።",
    empty: "እስካሁን የታተመ ጽሁፍ የለም — ቆየት ብለው ይመልከቱ።",
  },

  wizard: {
    eyebrow: "የተረጋገጡ አዘጋጅ ይሁኑ",
    title: "የአዘጋጅ ማረጋገጫ",
    steps: {
      verify: "ግንኙነት ማረጋገጥ",
      terms: "ውሎችና ስምምነት",
      documents: "ሰነዶችና ክፍያ",
      review: "ፊትና ማስገባት",
    },
    termsHeading: "ውሎቹን ይቀበሉ",
    termsSub:
      "ማንኛውንም ሰነድ ከመጫንዎ በፊት እባክዎ የሚከተሉትን ገምግመው ይቀበሉ። እያንዳንዱ ስምምነት ከጊዜ ማህተም ጋር ይመዘገባል።",
  },

  campaignForm: {
    writeHint:
      "ዘመቻዎን በአማርኛ ወይም በእንግሊዝኛ መጻፍ ይችላሉ — ለጋሾች እርስዎ በጻፉት መልኩ ያነብቡታል።",
    title: "የዘመቻ ርዕስ",
    titleHint: "ግልጽና የተለየ ይሁን — የተጋነነ ማስታወቂያ አይሁን።",
    category: "ምድብ",
    target: "የሚፈለግ መጠን (ብር)",
    targetHint: "ሙሉ ብር፣ ቢያንስ 1,000።",
    location: "አካባቢ",
    locationHint: "ከተማ ወይም ክልል (አማራጭ)።",
    locationPlaceholder: "ለምሳሌ አዲስ አበባ",
    endDate: "የመጨረሻ ቀን",
    endDateHint: "አማራጭ — ክፍት እንዲሆን ባዶ ይተዉት።",
    summary: "አጭር መግለጫ",
    summaryHint: "በዘመቻ ካርዶች ላይ ይታያል። 40–300 ፊደላት።",
    story: "ሙሉ ታሪክ",
    storyHint:
      "ሙሉ ገጽታው፦ ማን፣ ለምን፣ ገንዘቡ ምን እንደሚሸፍንና እድገቱ እንዴት እንደሚጋራ። ገምጋሚዎች ይህን ከደጋፊ ሰነዶችዎ ጋር ያመሳክራሉ።",
    currentHero: "አሁን ያለው ዋና ምስል",
    currentHeroHint: "ለመተካት ከታች አዲስ ምስል ይጫኑ፣ ወይም እንዲቆይ ባዶ ይተዉት።",
    heroReplace: "ዋና ምስል ይተኩ (አማራጭ)",
    heroOptional: "ዋና ምስል (አማራጭ)",
    uploadProof: "የማስረጃ ሰነድ ይጫኑ",
    createDraft: "ረቂቅ ፍጠር",
    footerNote:
      "ዘመቻዎ እንደ ረቂቅ ይፈጠራል። ሲዘጋጅ ለግምገማ ያስገቡት — በአስተዳዳሪ ከጸደቀ በኋላ ብቻ ይፋ ይሆናል።",
    saveChanges: "ለውጦችን አስቀምጥ",
    editFooterNote: "ለውጦች ወዲያውኑ ተቀምጠው በክለሳ መዝገብ ውስጥ ይመዘገባሉ።",
  },
};

export const dictionaries: Record<Locale, Dict> = { en, am };

/** Pick a dictionary by locale (client-safe). */
export function getDictFor(locale: Locale): Dict {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

/** Parse the locale from a raw cookie string (client-safe). */
export function localeFromCookie(cookie: string | undefined): Locale {
  const m = cookie?.match(/(?:^|;\s*)locale=([^;]+)/);
  return m?.[1] === "am" ? "am" : "en";
}
