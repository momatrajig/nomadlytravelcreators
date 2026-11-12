import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { Ico } from "@/components/Icon";

/** Says plainly that the numbers are made up, and how to see the real demo account. */
export default function SampleNote({ realHref }: { realHref: string }) {
  return <div className="notice small notice-inline sample-note"><Ico of={FlaskConical} size={16} /><span><b>Sample data.</b> A year of made up traffic so you can see every chart and table at work. Your real numbers replace it the day your storefront goes live. <Link href={realHref}>Show the real demo account</Link>.</span></div>;
}
