import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPolicy } from "@offbeatport/blocks/pages/privacy";

export const Route = createFileRoute("/privacy")({
  component: () => (
    <PrivacyPolicy
      appName="PreventReturn"
      contactEmail="hello@preventreturn.com"
      governingLaw="Ireland"
      effectiveDate="2026-05-13"
      additionalSections={[
        {
          title: "Shopify store data",
          body: "When you connect your Shopify store, PreventReturn accesses order data (buyer name, phone number, email, product details, and order value) solely to score return risk and send intervention messages. We do not store buyer personal data beyond the active intervention window. Order metadata used for model training is anonymised before retention.",
        },
        {
          title: "SMS and email communications",
          body: "Intervention messages are sent on your behalf using your store's identity. Buyers can reply STOP at any time to opt out of future messages from your store. We maintain opt-out lists per merchant store and honour them within 24 hours.",
        },
        {
          title: "Model training",
          body: "Aggregated, anonymised return outcome data (did the order return after intervention - yes/no) is used to improve the shared risk prediction model. No personally identifiable information is retained for this purpose.",
        },
      ]}
    />
  ),
});
