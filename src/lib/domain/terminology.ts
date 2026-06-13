export const BUSINESS_TERMS = {
  overseasAgency: {
    tablePrefix: "agency",
    label: "Overseas Agency",
    description:
      "Foreign travel agency customer that requests quotes, sells locally, sends passengers, and pays JHT."
  },
  domesticSupplier: {
    tablePrefix: "domestic_supplier",
    label: "Domestic Supplier",
    description:
      "Korea-side supplier that provides hotels, vehicles, restaurants, attractions, guides, and other costs."
  }
} as const;

export const PROHIBITED_GENERIC_TERMS = ["partner_account", "partner_user", "partner_price"];
