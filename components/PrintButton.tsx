"use client";
import { Printer } from "lucide-react";
import { Ico } from "@/components/Icon";
/** Prints the voucher: the print stylesheet keeps the booking and hides the site around it. */
export default function PrintButton({ label }: { label: string }) {
  return <button type="button" className="btn btn-brand" onClick={() => window.print()}><Ico of={Printer} size={17} />{label}</button>;
}
