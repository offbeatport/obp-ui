import { createFileRoute } from "@tanstack/react-router";
import { TermsOfService } from "@offbeatport/blocks/pages/terms";

export const Route = createFileRoute("/terms")({
  component: () => (
    <div className="w-full">
      <TermsOfService
        appName="LiveAIPulse"
        contactEmail="offbeatport@gmail.com"
        governingLaw="Romania"
      />
    </div>
  ),
});
