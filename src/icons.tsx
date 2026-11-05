import { createLucideIcon } from "lucide-react";

const CubePlus = createLucideIcon("cube-plus", [
    [
        "path",
        {
            d: "M21 12V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0",
            key: "cube",
        },
    ],
    ["path", { d: "m3.3 7 8.7 5 8.7-5", key: "top" }],
    ["path", { d: "M12 22V12", key: "edge" }],
    ["path", { d: "M16 19h6", key: "across" }],
    ["path", { d: "M19 16v6", key: "down" }],
]);

export { CubePlus };
