export type ParsedRoomingListPassenger = {
  passengerNo?: string;
  fullName: string;
  gender?: string;
  dateOfBirth?: string;
  dietaryRequirements?: string;
  passportNo?: string;
  coachLabel?: string;
};

export type ParsedRoomingListResult = {
  passengers: ParsedRoomingListPassenger[];
  errors: string[];
};

export function parseRoomingListText(
  text: string,
  options?: { delimiter?: "," | "\t" }
): ParsedRoomingListResult;

export function detectDelimiter(text: string): "," | "\t";
