import {
    IconFile,
    IconFileCode,
    IconFileCode2,
    IconFileDatabase,
    IconFileDigit,
    IconFileSpreadsheet,
    IconFileStack,
    IconFileText,
    IconSnowflake,
    IconTriangle,
} from "@tabler/icons-react";
import type { IconComponent } from "../icons";
import { cn } from "../lib/cn";

export type FileType =
    | "csv"
    | "tsv"
    | "json"
    | "jsonl"
    | "parquet"
    | "avro"
    | "iceberg"
    | "delta"
    | "sql"
    | "text"
    | "file";

type FileTypeInfo = { label: string; icon: IconComponent; tone: string };

export const FILE_TYPES: Record<FileType, FileTypeInfo> = {
    csv: { label: "CSV", icon: IconFileSpreadsheet, tone: "text-file-csv" },
    tsv: { label: "TSV", icon: IconFileSpreadsheet, tone: "text-file-tsv" },
    json: { label: "JSON", icon: IconFileCode2, tone: "text-file-json" },
    jsonl: { label: "JSON Lines", icon: IconFileStack, tone: "text-file-jsonl" },
    parquet: { label: "Parquet", icon: IconFileDatabase, tone: "text-file-parquet" },
    avro: { label: "Avro", icon: IconFileDigit, tone: "text-file-avro" },
    iceberg: { label: "Iceberg", icon: IconSnowflake, tone: "text-file-iceberg" },
    delta: { label: "Delta Lake", icon: IconTriangle, tone: "text-file-delta" },
    sql: { label: "SQL", icon: IconFileCode, tone: "text-file-sql" },
    text: { label: "Text", icon: IconFileText, tone: "text-file-text" },
    file: { label: "File", icon: IconFile, tone: "text-muted-foreground" },
};

const EXTENSIONS: Record<string, FileType> = {
    csv: "csv",
    tsv: "tsv",
    tab: "tsv",
    json: "json",
    jsonl: "jsonl",
    ndjson: "jsonl",
    parquet: "parquet",
    pq: "parquet",
    avro: "avro",
    iceberg: "iceberg",
    delta: "delta",
    sql: "sql",
    txt: "text",
    md: "text",
    log: "text",
};

const EXTENSION = /\.([a-z][a-z0-9]{0,9})$/i;

export function fileExtension(name: string): string {
    const match = EXTENSION.exec(name);
    return match && match.index > 0 ? match[0] : "";
}

export function fileTypeOf(nameOrFormat: string): FileType {
    const value = nameOrFormat.trim().toLowerCase();
    const extension = fileExtension(value).slice(1) || value.replace(/^\./, "");
    return EXTENSIONS[extension] ?? "file";
}

export function FileTypeIcon({
    name,
    type,
    className,
}: {
    name?: string;
    type?: FileType;
    className?: string;
}) {
    const info = FILE_TYPES[type ?? fileTypeOf(name ?? "")];
    const Icon = info.icon;
    return (
        <Icon aria-hidden="true" data-slot="file-type-icon" className={cn(info.tone, className)} />
    );
}

export function FileName({ name, className }: { name: string; className?: string }) {
    const extension = fileExtension(name);
    if (!extension) {
        return <span className={className}>{name}</span>;
    }
    return (
        <span data-slot="file-name" className={className}>
            {name.slice(0, -extension.length)}
            <span className="opacity-50">{extension}</span>
        </span>
    );
}
