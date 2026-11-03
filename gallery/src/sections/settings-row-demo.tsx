import {
    Badge,
    Button,
    Input,
    NumberField,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SettingsGroup,
    SettingsRow,
    Switch,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "obp-ui";
import { useState } from "react";
import { Api, Spec } from "../kit";

export function SettingsRowDemo() {
    const [digest, setDigest] = useState(true);
    const [retention, setRetention] = useState<number | null>(30);
    const [network, setNetwork] = useState("allowlist");
    return (
        <Spec
            name="SettingsRow · SettingsGroup"
            note="Label and description on the left, the control on the right, centred on the label's first line. A switch row toggles from anywhere on it; other rows only through their control."
        >
            <div className="max-w-3xl rounded-xl border bg-card p-5">
                <SettingsGroup>
                    <SettingsRow
                        id="sr-digest"
                        toggle
                        label="Daily digest"
                        description="One email at 08:00 with yesterday's runs, failures and spend. Click anywhere on the row."
                        control={
                            <Switch id="sr-digest" checked={digest} onCheckedChange={setDigest} />
                        }
                    />
                    <SettingsRow
                        id="sr-locked"
                        toggle
                        disabled
                        label="Send to Slack"
                        description="Locked rows keep their reason in a tooltip and do not highlight."
                        control={
                            <>
                                <Switch id="sr-locked" checked disabled />
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button type="button" className="rounded-sm">
                                            <Badge variant="neutral">Set by config file</Badge>
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Change it in the server config.</TooltipContent>
                                </Tooltip>
                            </>
                        }
                    />
                    <SettingsRow
                        id="sr-retention"
                        label="Log retention"
                        description="Request logs older than this are deleted."
                        control={
                            <NumberField
                                id="sr-retention"
                                value={retention}
                                onValueChange={setRetention}
                                min={1}
                                max={365}
                                format={{ maximumFractionDigits: 0 }}
                                unit="days"
                            />
                        }
                    />
                    <SettingsRow
                        id="sr-network"
                        label="Network"
                        description="Which hosts the server may reach."
                        control={
                            <Select value={network} onValueChange={setNetwork}>
                                <SelectTrigger id="sr-network" className="w-48">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="open">Open</SelectItem>
                                    <SelectItem value="allowlist">Allowlist</SelectItem>
                                    <SelectItem value="offline">Offline</SelectItem>
                                </SelectContent>
                            </Select>
                        }
                    />
                    <SettingsRow
                        id="sr-endpoint"
                        wide
                        label="Endpoint"
                        description="A wide control: fixed width on the right, below the label when the row is narrower than 36rem."
                        control={
                            <Input
                                id="sr-endpoint"
                                className="font-mono"
                                defaultValue="https://minio.internal:9000"
                            />
                        }
                    />
                    <SettingsRow
                        label="Catalogue"
                        description="Checked for updates 2 hours ago."
                        control={
                            <Button variant="outline" size="sm">
                                Check for updates
                            </Button>
                        }
                    />
                </SettingsGroup>
            </div>
            <div className="mt-5 border-t border-border-soft pt-4">
                <Api
                    items={[
                        {
                            name: "id",
                            note: "The control's id. The label points at it and the description becomes its aria-describedby. Leave it out for a button.",
                        },
                        {
                            name: "control",
                            note: "Switch, checkbox, NumberField, Select, Input or Button, first; extras such as a Save button or a locked badge follow it and grow away from it, so the control never moves. Its box is one label line tall, so a taller control overflows evenly. Below 28rem the row stacks.",
                        },
                        {
                            name: "toggle",
                            note: "The whole row is the control's label: a click anywhere toggles it, hover and keyboard focus tint the row. One name, one tab stop.",
                        },
                        {
                            name: "disabled",
                            note: "No highlight and no pointer on a toggle row; put the reason in a Tooltip on the control side.",
                        },
                        {
                            name: "wide",
                            note: "A 20rem control on the right, full width under the label in a narrow row.",
                        },
                        {
                            name: "error · children",
                            note: "An error line under the description; children sit under the row, inside its divider.",
                        },
                    ]}
                />
            </div>
        </Spec>
    );
}
