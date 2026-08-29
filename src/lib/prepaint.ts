import { DEFAULT_NAMESPACE } from "./theme";

export type PrePaintClassPref = {
    key: string;
    className: string;
    whenValue: string;
};

export const consoleTabPref = (ns: string = DEFAULT_NAMESPACE): PrePaintClassPref => ({
    key: `${ns}-console-tab`,
    className: "console-tab-off",
    whenValue: "off",
});

export function prePaintScript(
    ns: string = DEFAULT_NAMESPACE,
    extra: PrePaintClassPref[] = [consoleTabPref(ns)],
): string {
    const extras = extra
        .map(
            (p) =>
                `if(localStorage.getItem(${JSON.stringify(p.key)})===${JSON.stringify(p.whenValue)})d.classList.add(${JSON.stringify(p.className)});`,
        )
        .join("");
    const themeKeyLiteral = JSON.stringify(`${ns}-theme`);
    return `try{var d=document.documentElement;var t=localStorage.getItem(${themeKeyLiteral});if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))d.classList.add('dark');${extras}}catch(e){}`;
}
