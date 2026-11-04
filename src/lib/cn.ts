import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
    extend: {
        theme: {
            spacing: ["panel", "panel-gap", "field", "label"],
        },
        classGroups: {
            shadow: [{ shadow: ["e1", "e2"] }],
        },
    },
});

export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}
