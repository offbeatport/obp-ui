import { createFileRoute } from "@tanstack/react-router";
import { TermsOfService } from "@offbeatport/blocks/pages/terms";

export const Route = createFileRoute("/terms")({
  component: () => (
    <TermsOfService
      appName="PreventReturn"
      contactEmail="hello@preventreturn.com"
      governingLaw="Ireland"
      effectiveDate="2026-05-13"
      additionalSections={[
        {
          title: "Shopify integration",
          body: "By connecting your Shopify store you authorise PreventReturn to read order data and register an orders/create webhook. You can revoke this access at any time from your Shopify admin under Apps. Revoking access immediately stops all agent activity on your store.",
        },
        {
          title: "Intervention messages",
          body: "You are responsible for ensuring your customers have provided consent to receive SMS or email messages from your store. PreventReturn sends messages on your behalf - you remain the sender of record. You agree not to use PreventReturn to send unsolicited or deceptive communications.",
        },
        {
          title: "Performance billing",
          body: "On the Performance plan, fees are calculated as 15% of verified net savings (returns prevented minus cancellations caused) at the end of each calendar month. If net savings are zero or negative, no fee is charged. Verified net savings calculations are final unless disputed within 14 days of the monthly statement.",
        },
        {
          title: "No guarantee of results",
          body: "PreventReturn does not guarantee a specific reduction in your return rate. Return outcomes depend on many factors outside our control including product quality, buyer behaviour, and carrier performance. Past results shown in demos use representative merchant data and are not a promise of future performance.",
        },
      ]}
    />
  ),
});
