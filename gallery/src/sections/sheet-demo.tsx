import {
    Button,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    OptionalNumberField,
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "obp-ui";
import { useState } from "react";
import { Note, Row, Spec } from "../kit";

const REASONING =
    "The ticket mentions a refund and a card charged twice, so billing fits better than bug. Nothing in it asks about features, which rules out other.";

export function CollapsibleDemo() {
    const [open, setOpen] = useState(false);
    return (
        <Spec
            name="Collapsible"
            note="A section that opens in place: a text button with a chevron that turns as it opens, and the content under it. No height animation; the content fades in and out over 100ms."
        >
            <div className="grid gap-8 lg:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <Collapsible open={open} onOpenChange={setOpen}>
                        <CollapsibleTrigger className="font-normal text-muted-foreground hover:text-foreground">
                            Reasoning, 3 s
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 border-l pl-3 text-sm text-muted-foreground">
                            {REASONING}
                        </CollapsibleContent>
                    </Collapsible>
                    <p className="text-base">billing</p>
                    <Note>open: {String(open)}</Note>
                </div>
                <div className="flex flex-col divide-y rounded-lg border">
                    <Collapsible defaultOpen className="p-4">
                        <CollapsibleTrigger>Sampling</CollapsibleTrigger>
                        <CollapsibleContent className="pt-2 text-sm text-muted-foreground">
                            Temperature, Top P and Top K.
                        </CollapsibleContent>
                    </Collapsible>
                    <Collapsible className="p-4">
                        <CollapsibleTrigger>Penalties</CollapsibleTrigger>
                        <CollapsibleContent className="pt-2 text-sm text-muted-foreground">
                            Frequency, presence and repetition.
                        </CollapsibleContent>
                    </Collapsible>
                    <Collapsible disabled className="p-4">
                        <CollapsibleTrigger>
                            Structured output (not on this engine)
                        </CollapsibleTrigger>
                    </Collapsible>
                </div>
            </div>
        </Spec>
    );
}

export function SheetDemo() {
    const [temperature, setTemperature] = useState<number | null>(null);
    const [maxTokens, setMaxTokens] = useState<number | null>(1024);
    return (
        <Spec
            name="Sheet"
            note="A side drawer on the Dialog: full height, full width on a phone and 24rem from sm, a border on its inner edge only, the Dialog's overlay and close button. It fades in; it does not slide. For a settings panel that has no room beside the page."
        >
            <Row>
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline">Settings</Button>
                    </SheetTrigger>
                    <SheetContent>
                        <SheetHeader>
                            <SheetTitle>Settings</SheetTitle>
                            <SheetDescription>
                                Unset settings are not sent; the engine's defaults apply.
                            </SheetDescription>
                        </SheetHeader>
                        <div className="flex flex-col gap-4">
                            <OptionalNumberField
                                id="sheet-temperature"
                                label="Temperature"
                                help="Higher values make the output more varied."
                                value={temperature}
                                onValueChange={setTemperature}
                                min={0}
                                max={2}
                                step={0.01}
                                fallback={0.7}
                                format={{ maximumFractionDigits: 2 }}
                            />
                            <OptionalNumberField
                                id="sheet-max-tokens"
                                label="Max tokens"
                                value={maxTokens}
                                onValueChange={setMaxTokens}
                                min={1}
                                max={32768}
                                largeStep={1024}
                                fallback={2048}
                                format={{ maximumFractionDigits: 0, useGrouping: false }}
                            />
                            <Collapsible>
                                <CollapsibleTrigger>Advanced</CollapsibleTrigger>
                                <CollapsibleContent className="pt-2 text-sm text-muted-foreground">
                                    Penalties, seed and stop sequences.
                                </CollapsibleContent>
                            </Collapsible>
                        </div>
                        <div className="mt-auto flex justify-end gap-2">
                            <SheetClose asChild>
                                <Button variant="outline">Done</Button>
                            </SheetClose>
                        </div>
                    </SheetContent>
                </Sheet>
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost">Open on the left</Button>
                    </SheetTrigger>
                    <SheetContent side="left">
                        <SheetHeader>
                            <SheetTitle>History</SheetTitle>
                            <SheetDescription>Earlier runs of this prompt.</SheetDescription>
                        </SheetHeader>
                        <Note>Nothing yet.</Note>
                    </SheetContent>
                </Sheet>
            </Row>
        </Spec>
    );
}
