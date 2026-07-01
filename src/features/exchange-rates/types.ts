export type ExchangeRateListItem = {
  id: string;
  countryCode: string | null;
  countryName: string | null;
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  effectiveDate: string;
  source: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
};

export type ExchangeRateFilters = {
  countryCode?: string;
  baseCurrency?: string;
  quoteCurrency?: string;
  status?: string;
};
