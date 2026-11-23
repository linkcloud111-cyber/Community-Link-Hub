import PublishedCmsPageView from "@/components/cms/PublishedCmsPageView";

export default function AboutPage() {
  return (
    <PublishedCmsPageView
      slug="about"
      badgeLabel="About LinkCloud"
      defaultTitle="About LinkCloud"
      defaultSubtitle="Community Discovery Directory"
      defaultDescription="Learn about LinkCloud, how communities are curated, and our platform safety approach."
      canonicalPath="/about"
      unavailableTitle="About Page Pending Publication"
      unavailableMessage="Our About page details are currently in draft or being updated by the Webmaster. Please browse public communities or contact support for assistance."
      footerAction={{
        href: "/submit",
        label: "Submit Your Community",
      }}
    />
  );
}
