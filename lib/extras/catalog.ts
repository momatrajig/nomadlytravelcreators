/**
 * Veny services sold alongside a stay. Prices and Nomadly's commission are per item; the creator
 * earns half of the commission (option D). Until Veny's live rate card is loaded these are the
 * pilot prices, flagged so the dashboard can show them as such.
 */
export type ExtraKind = "transfer" | "esim" | "bag" | "delay";
export interface ExtraProduct {
  kind: ExtraKind;
  name: string;
  short: string;
  detail: string;
  price: number;
  elsewhere: number;
  commission: number;
  icon: "car" | "sim" | "luggage" | "umbrella";
}

export const EXTRAS: ExtraProduct[] = [
  { kind: "transfer", name: "Airport pickup, private car", short: "Driver waits at arrivals with your name. Flight tracked.", detail: "A licensed driver meets you at arrivals with a name board, tracks your flight so a delay costs you nothing, and takes you straight to the hotel. Cancel free up to 24 hours before landing.", price: 78, elsewhere: 95, commission: 27.3, icon: "car" },
  { kind: "esim", name: "eSIM, 10 GB for 30 days", short: "Data the moment you land. Installed by QR code before you fly.", detail: "A European eSIM with 10 GB for 30 days, installed from a QR code we email you. Works in Portugal and across the EU. Your own number stays active for calls and messages.", price: 12, elsewhere: 18, commission: 4, icon: "sim" },
  { kind: "bag", name: "Bag protection", short: "Lost or delayed bag: USD 500 paid within 48 hours, no forms.", detail: "If the airline loses or delays your checked bag more than 8 hours, you receive USD 500 within 48 hours of the claim, by card, with no receipts to collect. Covers the whole trip.", price: 9, elsewhere: 31, commission: 4, icon: "luggage" },
  { kind: "delay", name: "Flight delay cover", short: "Delay over 3 hours: USD 150 paid automatically.", detail: "We watch your flights. If one is delayed more than 3 hours, USD 150 lands on your card automatically, usually before you take off. Nothing to claim.", price: 11, elsewhere: 36, commission: 5, icon: "umbrella" },
];

export const extraByKind = (k: string) => EXTRAS.find((e) => e.kind === k) ?? null;
