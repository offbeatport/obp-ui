import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    OptionalNumberField,
    Slider,
} from "obp-ui";
import { useState } from "react";
import { Api, Cell, Note, Row, Spec } from "../kit";

type Settings = {
    temperature: number | null;
    topP: number | null;
    maxTokens: number | null;
    frequencyPenalty: number | null;
    seed: number | null;
};

const UNSET: Settings = {
    temperature: 0.4,
    topP: null,
    maxTokens: null,
    frequencyPenalty: null,
    seed: null,
};

function sent(settings: Settings) {
    return JSON.stringify(
        Object.fromEntries(Object.entries(settings).filter(([, value]) => value !== null)),
    );
}

export function SliderDemo() {
    const [volume, setVolume] = useState(40);
    const [ratio, setRatio] = useState(0.25);
    const [unset, setUnset] = useState<number | null>(null);
    return (
        <Spec
            name="Slider"
            note="One thumb on a 4px track. Arrows step, Shift and Page Up/Down take the large step (ten steps by default), Home and End jump. muted draws no range: the value is not being sent, and moving the thumb sets it."
        >
            <Row className="items-start gap-8">
                <Cell label="0-100" className="w-56">
                    <Slider
                        id="slider-volume"
                        value={volume}
                        onValueChange={setVolume}
                        aria-label="Volume"
                    />
                    <Note>value: {volume}</Note>
                </Cell>
                <Cell label="step 0.01" className="w-56">
                    <Slider
                        value={ratio}
                        onValueChange={setRatio}
                        min={0}
                        max={1}
                        step={0.01}
                        aria-label="Ratio"
                    />
                    <Note>value: {ratio.toFixed(2)}</Note>
                </Cell>
                <Cell label="muted" className="w-56">
                    <Slider
                        value={unset ?? 0.7}
                        onValueChange={setUnset}
                        muted={unset === null}
                        min={0}
                        max={2}
                        step={0.01}
                        aria-label="Temperature"
                    />
                    <Note>value: {unset === null ? "unset" : unset.toFixed(2)}</Note>
                </Cell>
                <Cell label="disabled" className="w-56">
                    <Slider value={60} onValueChange={() => {}} disabled aria-label="Locked" />
                </Cell>
            </Row>
        </Spec>
    );
}

export function OptionalNumberFieldDemo() {
    const [settings, setSettings] = useState<Settings>(UNSET);
    const set = (key: keyof Settings) => (value: number | null) =>
        setSettings((current) => ({ ...current, [key]: value }));
    return (
        <Spec
            name="OptionalNumberField"
            note="A setting that may be left out of a request. Empty means Unset: nothing is sent and the engine's default applies, the slider rests muted at fallback. Typing, a step or moving the slider sets it; the X or clearing the input unsets it."
        >
            <div className="flex flex-wrap items-start gap-8">
                <div className="flex w-70 flex-col gap-4 rounded-lg border bg-card p-4">
                    <OptionalNumberField
                        id="onf-temperature"
                        label="Temperature"
                        help="Higher values make the output more varied. Unset uses the model's default."
                        value={settings.temperature}
                        onValueChange={set("temperature")}
                        min={0}
                        max={2}
                        step={0.01}
                        fallback={0.7}
                        format={{ maximumFractionDigits: 2 }}
                    />
                    <OptionalNumberField
                        id="onf-top-p"
                        label="Top P"
                        help="Samples only from the most likely tokens whose probabilities add up to this."
                        value={settings.topP}
                        onValueChange={set("topP")}
                        min={0}
                        max={1}
                        step={0.01}
                        fallback={1}
                        format={{ maximumFractionDigits: 2 }}
                    />
                    <OptionalNumberField
                        id="onf-max-tokens"
                        label="Max tokens"
                        help="The longest answer, in tokens."
                        value={settings.maxTokens}
                        onValueChange={set("maxTokens")}
                        min={1}
                        max={32768}
                        step={1}
                        largeStep={1024}
                        fallback={2048}
                        format={{ maximumFractionDigits: 0, useGrouping: false }}
                    />
                    <Collapsible>
                        <CollapsibleTrigger>Advanced</CollapsibleTrigger>
                        <CollapsibleContent className="flex flex-col gap-4 pt-4">
                            <OptionalNumberField
                                id="onf-frequency"
                                label="Frequency penalty"
                                help="Positive values make repeated tokens less likely."
                                value={settings.frequencyPenalty}
                                onValueChange={set("frequencyPenalty")}
                                min={-2}
                                max={2}
                                step={0.1}
                                fallback={0}
                                format={{ maximumFractionDigits: 1 }}
                            />
                            <OptionalNumberField
                                id="onf-seed"
                                label="Seed"
                                help="The same seed and settings repeat the same answer."
                                value={settings.seed}
                                onValueChange={set("seed")}
                                min={0}
                                step={1}
                                format={{ maximumFractionDigits: 0, useGrouping: false }}
                            />
                        </CollapsibleContent>
                    </Collapsible>
                    <OptionalNumberField
                        id="onf-disabled"
                        label="Repetition penalty"
                        value={1.1}
                        onValueChange={() => {}}
                        min={1}
                        max={2}
                        step={0.05}
                        disabled
                    />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <Note>
                        sent: <span className="font-mono">{sent(settings)}</span>
                    </Note>
                    <Api
                        items={[
                            {
                                name: "value · onValueChange",
                                note: "A number, or null for Unset. null means: leave it out of the request.",
                            },
                            {
                                name: "min · max · step · largeStep",
                                note: "Shared by the input and the slider. largeStep defaults to ten steps.",
                            },
                            {
                                name: "fallback",
                                note: "Where the muted slider rests and where the first step from Unset lands: the engine's default when known.",
                                value: "min ?? 0",
                            },
                            {
                                name: "slider",
                                note: "The slider row. On by default when min and max are both finite.",
                            },
                            {
                                name: "help",
                                note: "An InfoTip after the label, named About <label>.",
                            },
                            {
                                name: "format · unsetLabel · disabled",
                                note: "Intl options for the input; the placeholder while unset.",
                                value: '"Unset"',
                            },
                        ]}
                    />
                </div>
            </div>
        </Spec>
    );
}
