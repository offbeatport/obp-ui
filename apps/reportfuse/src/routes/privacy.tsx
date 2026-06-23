import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPolicy } from "@offbeatport/blocks/pages/privacy";

export const Route = createFileRoute("/privacy")({
  component: () => (
    <PrivacyPolicy
      appName="ReportFuse"
      contactEmail="hello@reportfuse.com"
      governingLaw="Delaware, United States"
    />
  ),
});
