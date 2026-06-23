import { createFileRoute } from "@tanstack/react-router";
import { TermsOfService } from "@offbeatport/blocks/pages/terms";

export const Route = createFileRoute("/terms")({
  component: () => (
    <TermsOfService
      appName="ReportFuse"
      contactEmail="hello@reportfuse.com"
      governingLaw="Delaware, United States"
    />
  ),
});
