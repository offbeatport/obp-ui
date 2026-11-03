import {
    Field,
    NumberField,
    NumberFieldDecrement,
    NumberFieldGroup,
    NumberFieldIncrement,
    NumberFieldInput,
} from "obp-ui";
import { useState } from "react";
import { Api, Note, Spec } from "../kit";

export function NumberFieldDemo() {
    const [rows, setRows] = useState<number | null>(3000);
    return (
        <Spec
            name="NumberField"
            note="Minus, input, plus as one control. Arrows step, Shift or Page Up/Down take the large step, Home and End jump to the limits, a held button repeats, typing clamps on blur."
        >
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                <Field id="nf-default" label="Default">
                    <NumberField id="nf-default" defaultValue={3} />
                </Field>
                <Field id="nf-range" label="Min 0, max 10" hint="The buttons stop at the limits.">
                    <NumberField id="nf-range" defaultValue={10} min={0} max={10} />
                </Field>
                <Field id="nf-decimal" label="Decimal, step 0.25">
                    <NumberField
                        id="nf-decimal"
                        defaultValue={1.5}
                        step={0.25}
                        min={0}
                        format={{ minimumFractionDigits: 2 }}
                    />
                </Field>
                <Field id="nf-percent" label="Percent">
                    <NumberField
                        id="nf-percent"
                        defaultValue={0.9}
                        min={0.5}
                        max={1}
                        step={0.01}
                        largeStep={0.1}
                        format={{ style: "percent" }}
                    />
                </Field>
                <Field id="nf-currency" label="Currency">
                    <NumberField
                        id="nf-currency"
                        defaultValue={49}
                        min={0}
                        step={5}
                        format={{ style: "currency", currency: "EUR" }}
                        groupClassName="w-36"
                    />
                </Field>
                <Field id="nf-disabled" label="Disabled">
                    <NumberField id="nf-disabled" defaultValue={5} disabled />
                </Field>
                <Field id="nf-unit" label="With a unit" hint="Large step 1,000 with Shift.">
                    <NumberField
                        id="nf-unit"
                        value={rows}
                        onValueChange={setRows}
                        min={10}
                        step={100}
                        largeStep={1000}
                        format={{ maximumFractionDigits: 0 }}
                        unit="rows"
                        groupClassName="w-36"
                    />
                </Field>
                <Field id="nf-parts" label="Composed from parts">
                    <NumberField id="nf-parts" defaultValue={2} min={1} max={8}>
                        <NumberFieldGroup className="w-28">
                            <NumberFieldDecrement />
                            <NumberFieldInput />
                            <NumberFieldIncrement />
                        </NumberFieldGroup>
                    </NumberField>
                </Field>
            </div>
            <div className="mt-4">
                <Note>
                    value: <span className="font-mono">{rows ?? "empty"}</span>
                </Note>
            </div>
            <div className="mt-5 border-t border-border-soft pt-4">
                <Api
                    items={[
                        {
                            name: "value · defaultValue",
                            note: "A number, or null when the field is empty. onValueChange gets every parseable change.",
                        },
                        {
                            name: "min · max · step",
                            note: "Clamped while typing and on blur. Typed values between steps are kept.",
                        },
                        {
                            name: "largeStep · smallStep",
                            note: "Shift or Page Up/Down, and Alt. Default 10 and 0.1.",
                        },
                        {
                            name: "format",
                            note: "Intl.NumberFormat options; maximumFractionDigits: 0 keeps it whole.",
                        },
                        {
                            name: "unit",
                            note: "Muted text after the control, read with the input.",
                        },
                        {
                            name: "groupClassName",
                            note: "Width of the bordered control; w-32 by default.",
                        },
                    ]}
                />
            </div>
        </Spec>
    );
}
