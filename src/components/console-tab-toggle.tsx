import { useEffect, useState } from "react";
import { Switch } from "~/components/ui/switch";
import { getConsoleTabHidden, onConsoleTabChange, setConsoleTabHidden } from "~/lib/console-prefs";

// Show/hide the agent-console launcher tab. Reads the real value after mount (SSR
// renders the shown default) and stays in sync with the pre-paint <html> class.
export function ConsoleTabToggle() {
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        const sync = () => setHidden(getConsoleTabHidden());
        sync();
        return onConsoleTabChange(sync);
    }, []);

    return (
        <Switch
            checked={!hidden}
            onCheckedChange={(shown) => setConsoleTabHidden(!shown)}
            aria-label="Show the agent console button"
        />
    );
}
