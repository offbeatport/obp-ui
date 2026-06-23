import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPolicy } from "@offbeatport/blocks/pages/privacy";

export const Route = createFileRoute("/privacy")({
  component: () => (
    <div className="w-full">
      <PrivacyPolicy
        appName="LiveAIPulse"
        contactEmail="offbeatport@gmail.com"
        governingLaw="Romania"
      />
    </div>
  ),
});
