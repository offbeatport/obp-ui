"use client";

import { useEffect, useState } from "react";
import type { DomClassPref } from "../lib/dom-class-pref";
import { Switch } from "../primitives";

// Show/hide the console launcher tab. Reads the real value after mount (SSR renders the
// shown default) and stays in sync with the pre-paint <html> class, so two copies of this
// switch on the same page never disagree.
//
// The preference itself is the app's (it owns the storage key + namespace); this takes the
// store it built with createDomClassPref().

export type ConsoleTabToggleProps = {
    /** The pref whose ON state HIDES the tab - i.e. the `console-tab-off` class. */
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
