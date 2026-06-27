export type SupplierCategory =
  | "hotel"
  | "vehicle"
  | "restaurant"
  | "attraction"
  | "guide"
  | "shopping"
  | "local_government"
  | "tourism_board"
  | "other";

export type RecordStatus = "active" | "inactive" | "archived";

export type SupplierListItem = {
  id: string;
  category: SupplierCategory;
  nameKo: string;
  nameEn: string | null;
  regionLevel1: string | null;
  regionLevel2: string | null;
  phone: string | null;
  website: string | null;
  status: RecordStatus;
  contactCount: number;
  productCount: number;
  updatedAt: string;
};

export type SupplierContact = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  kakaoAvailable: boolean;
  receivesBookingMessages: boolean;
  notes: string | null;
  status: RecordStatus;
};

export type SupplierPrice = {
  id: string;
  pricingUnit: string;
  currency: string;
  costAmount: number;
  minPax: number | null;
  maxPax: number | null;
  seasonLabel: string | null;
  validFrom: string | null;
  validTo: string | null;
  weekdayRule: string | null;
  includesTax: boolean;
  status: RecordStatus;
};

export type SupplierProduct = {
  id: string;
  productType: string;
  nameKo: string;
  nameEn: string | null;
  searchName: string;
  description: string | null;
  capacity: number | null;
  roomType: string | null;
  breakfastIncluded: boolean | null;
  vehicleSeatCount: number | null;
  menuTags: string[] | null;
  status: RecordStatus;
  prices: SupplierPrice[];
};

export type SupplierDetail = SupplierListItem & {
  address: string | null;
  googlePlaceId: string | null;
  naverMapUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  internalNotes: string | null;
  contacts: SupplierContact[];
  products: SupplierProduct[];
};

export type SupplierListFilters = {
  q?: string;
  category?: string;
  status?: string;
};
