export type CountryReference = {
  countryCode: string;
  countryName: string;
  defaultCurrency: string | null;
  aliases: string[];
  source: string;
  status: string;
  createdAt: string;
};

export type CountryReferenceFilters = {
  q?: string;
  status?: string;
};
