import PublishedCmsPageView from "@/components/cms/PublishedCmsPageView";

export default function DisclaimerPage() {
  return (
    <PublishedCmsPageView
      slug="disclaimer"
      badgeLabel="Legal Notice"
      badgeTone="amber"
      defaultTitle="Legal Disclaimer"
      defaultSubtitle="Public Directory & Third-Party Links Notice"
      defaultDescription="Review the official Legal Disclaimer for LinkCloud once published by the Webmaster."
      canonicalPath="/disclaimer"
      unavailableTitle="Legal Disclaimer Pending Review"
      unavailableMessage="The official Legal Disclaimer is currently in draft or undergoing compliance review. Please contact our support team if you have any compliance questions."
    />
  );
}
