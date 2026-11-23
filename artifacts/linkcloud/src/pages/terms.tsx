import PublishedCmsPageView from "@/components/cms/PublishedCmsPageView";

export default function TermsPage() {
  return (
    <PublishedCmsPageView
      slug="terms"
      badgeLabel="Legal Agreement"
      defaultTitle="Terms & Conditions"
      defaultSubtitle="User Agreement & Platform Rules"
      defaultDescription="Review the official LinkCloud Terms & Conditions once published by the Webmaster."
      canonicalPath="/terms"
      unavailableTitle="Terms & Conditions Pending Review"
      unavailableMessage="The official Terms & Conditions document is currently in draft or undergoing compliance review. Please check back soon or reach out via our Contact or Complaint portals."
    />
  );
}
