import PublishedCmsPageView from "@/components/cms/PublishedCmsPageView";

export default function PrivacyPage() {
  return (
    <PublishedCmsPageView
      slug="privacy"
      badgeLabel="Legal & Trust"
      defaultTitle="Privacy Policy"
      defaultSubtitle="Data Protection & Privacy Notice"
      defaultDescription="Review the official LinkCloud Privacy Policy once published by the Webmaster."
      canonicalPath="/privacy"
      unavailableTitle="Privacy Policy Pending Review"
      unavailableMessage="The official Privacy Policy is currently in draft or undergoing compliance review. For immediate privacy inquiries, please contact our support desk or submit a request via the Complaint portal."
    />
  );
}
