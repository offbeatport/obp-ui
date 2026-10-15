import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / "src/styles/fonts/iosevka"
CSS_FILE = ROOT / "src/styles/fonts-iosevka.css"

SUBSETS = {
    "latin": "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    "latin-ext": "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    "symbols": "U+2190-21FF, U+2200-22FF, U+2300-23FF, U+2500-25FF, U+2713-2718",
}
FEATURES = "calt,liga,ccmp,locl,kern,mark,mkmk,tnum,zero,frac,dlig"
FAMILIES = {
    "iosevka": ("Iosevka", "Iosevka"),
    "iosevka-aile": ("IosevkaAile", "Iosevka Aile"),
}
STYLES = {
    ("400", "normal"): "Regular",
    ("500", "normal"): "Medium",
    ("600", "normal"): "SemiBold",
    ("700", "normal"): "Bold",
    ("400", "italic"): "Italic",
    ("700", "italic"): "BoldItalic",
}


def subset(source: Path, target: Path, unicodes: str) -> None:
    subprocess.run(
        [
            sys.executable,
            "-I",
            "-m",
            "fontTools.subset",
            str(source),
            f"--unicodes={unicodes.replace(' ', '')}",
            f"--layout-features={FEATURES}",
            "--flavor=woff2",
            f"--output-file={target}",
        ],
        check=True,
    )


def font_face(family: str, weight: str, style: str, file: str, unicodes: str) -> str:
    return "\n".join(
        [
            "@font-face {",
            f'    font-family: "{family}";',
            f"    font-style: {style};",
            f"    font-weight: {weight};",
            "    font-display: swap;",
            f'    src: url("./fonts/iosevka/{file}") format("woff2");',
            f"    unicode-range: {unicodes};",
            "}",
        ]
    )


def main(release_woff2_dir: str) -> None:
    source_dir = Path(release_woff2_dir)
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    rules = []
    for slug, (release_name, family) in FAMILIES.items():
        for (weight, style), suffix in STYLES.items():
            for name, unicodes in SUBSETS.items():
                file = f"{slug}-{name}-{weight}-{style}.woff2"
                subset(source_dir / f"{release_name}-{suffix}.woff2", FONT_DIR / file, unicodes)
                rules.append(font_face(family, weight, style, file, unicodes))
    CSS_FILE.write_text("\n".join(rules) + "\n")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python3 scripts/subset-iosevka.py <dir with the release's WOFF2-Unhinted files>")
    main(sys.argv[1])
