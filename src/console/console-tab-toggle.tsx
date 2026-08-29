"use client";

import { useEffect, useState } from "react";
import type { DomClassPref } from "../lib/dom-class-pref";
import { Switch } from "../primitives";

export type ConsoleTabToggleProps = {
    pref: DomClassPref;
    label?: string;
};

export function ConsoleTabToggle({
    pref,
    label = "Show the agent console button",
}: ConsoleTabToggleProps) {
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        const sync = () => setHidden(pref.get());
        sync();
        return pref.subscribe(sync);
    }, [pref]);

    return (
        <Switch
            checked={!hidden}
            onCheckedChange={(shown) => pref.set(!shown)}
            aria-label={label}
        />
    );
}
