function foldText(text: string): string {
    return text
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();
}

function searchTerms(query: string): string[] {
    return foldText(query).split(/\s+/).filter(Boolean);
}

type MatchRange = readonly [start: number, end: number];

function foldedWithOffsets(text: string): { folded: string; offsets: number[] } {
    let folded = "";
    const offsets: number[] = [];
    let index = 0;
    for (const char of text) {
        const piece = foldText(char);
        for (let unit = 0; unit < piece.length; unit += 1) {
            offsets.push(index);
        }
        folded += piece;
        index += char.length;
    }
    offsets.push(index);
    return { folded, offsets };
}

function merged(ranges: MatchRange[]): MatchRange[] {
    const sorted = [...ranges].sort((left, right) => left[0] - right[0]);
    const out: [number, number][] = [];
    for (const [start, end] of sorted) {
        const last = out[out.length - 1];
        if (last && start <= last[1]) {
            last[1] = Math.max(last[1], end);
        } else {
            out.push([start, end]);
        }
    }
    return out;
}

function matchRanges(text: string, query: string): MatchRange[] {
    const terms = searchTerms(query);
    if (terms.length === 0 || !text) {
        return [];
    }
    const { folded, offsets } = foldedWithOffsets(text);
    const ranges: MatchRange[] = [];
    for (const term of terms) {
        let at = folded.indexOf(term);
        while (at !== -1) {
            ranges.push([offsets[at] ?? 0, offsets[at + term.length] ?? text.length]);
            at = folded.indexOf(term, at + term.length);
        }
    }
    return merged(ranges);
}

export { foldText, type MatchRange, matchRanges, searchTerms };
