import type { CompanyAction, CompanyDetail } from "~/server/data";

// The patch a Setup/Growth tab sends to persist company config (updateCompanySettings minus id).
export type CompanySettingsPatch = {
    domain?: string;
    budgetCapUsd?: number | null;
    autopilot?: "off" | "on";
    pricing?: { plan?: string; priceUsd?: number; interval?: "month" | "year" };
    channels?: { kind: string; status: string; budgetIntentUsd?: number }[];
    gitRemote?: string;
};

// Every company-workspace tab gets the same props: the full company detail, its task list
// (actions), and the mutation callbacks the $slug route already owns (approve/reject a task,
// patch settings). Tabs are pure presentational components over this contract.
export type CompanyTabProps = {
    co: CompanyDetail;
    actions: CompanyAction[];
    busy: boolean;
    onApprove: (actionId: string) => Promise<void>;
    onReject: (actionId: string) => Promise<void>;
    onUpdate: (patch: CompanySettingsPatch) => Promise<void>;
};
