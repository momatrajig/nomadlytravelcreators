"use client";
/** Prints the voucher: the print stylesheet keeps the booking and hides the site around it. */
export default function PrintButton({ label }: { label: string }) {
  return <button type="button" className="btn btn-brand" onClick={() => window.print()}>{label}</button>;
}
