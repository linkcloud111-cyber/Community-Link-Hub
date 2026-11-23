import PublishedCmsPageView from "@/components/cms/PublishedCmsPageView";

export default function DMCAPage() {
  return (
    <PublishedCmsPageView
      slug="dmca"
      badgeLabel="Copyright Compliance"
      badgeTone="destructive"
      defaultTitle="DMCA & Copyright Takedown Policy"
      defaultSubtitle="Notice and Takedown Procedure"
      defaultDescription="Review LinkCloud's DMCA & Copyright Takedown Procedure and file copyright complaints."
      canonicalPath="/dmca"
      unavailableTitle="DMCA Policy Pending Review"
      unavailableMessage="The official DMCA & Copyright Takedown Policy is currently in draft or undergoing compliance review. If you need to file an urgent copyright takedown request right now, please use our Complaint portal."
      footerAction={{
        href: "/complaint",
        label: "Submit DMCA / Copyright Complaint",
      }}
    />
  );
}
