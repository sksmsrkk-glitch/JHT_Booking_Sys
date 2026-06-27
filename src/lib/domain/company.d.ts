export type CompanyCreateInput = {
  code: string;
  nameKo: string;
  nameEn: string;
};

export type CompanyCreateRow = {
  code: string;
  name_ko: string;
  name_en: string;
  status: "active";
};

export function buildCompanyCreateRow(input: CompanyCreateInput): CompanyCreateRow;
