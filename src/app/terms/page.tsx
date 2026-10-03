import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      subtitle="Our Terms of service for now. We'll update you with the latest terms and condition very soon"
      docName="Terms of Service"
    />
  );
}
