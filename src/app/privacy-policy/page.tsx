import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      subtitle="Our Privacy terms for now. We'll update you with the latest terms and condition very soon"
      docName="Privacy policy"
    />
  );
}
