export function makeWorkflowCode(input: {
  countryCode: string;
  agencyName: string;
  submittedAt?: Date;
}): string;

export function makeVersionedDocumentNo(
  workflowCode: string,
  documentType: "INV" | "CNF",
  versionNo: number
): string;
