import {
    GradientMark,
    type GradientMarkBranding,
    LogoMark,
    PALETTES,
    type ProviderId,
    ProviderLogo,
    paletteFor,
} from "@paperkit/ui";
import { Api, Cell, Note, Row, Spec } from "../kit";

// Brand marks: the product tile and the per-entity avatar. A product WORDMARK is not part of
// the kit - it stays with the product it names, which is why there is none here.

const ENTITIES: { name: string; branding?: GradientMarkBranding }[] = [
    { name: "Ledgerly" },
    { name: "Postmark Studio" },
    { name: "Quietbill", branding: { mark: "QB", palette: PALETTES[3] } },
    { name: "Harbourline" },
    { name: "Nudge" },
];

const PROVIDERS: ProviderId[] = [
    "anthropic",
    "openai",
    "google",
    "perplexity",
    "xai",
    "openrouter",
    "zai",
];

export function BrandSection() {
    return (
        <>
            <Spec
                name="LogoMark"
                note="the product's brand tile: one letter on a radial tint. Defaults reproduce the cslopslop C exactly."
            >
                <Row className="gap-8">
                    <Cell label="default">
                        <LogoMark />
                    </Cell>
                    <Cell label="size={40}">
                        <LogoMark size={40} />
                    </Cell>
                    <Cell label="size={64} letter='P'">
                        <LogoMark size={64} letter="P" />
                    </Cell>
                    <Cell label="tint / highlight">
                        <LogoMark
                            size={40}
                            letter="I"
                            tint="var(--info)"
                            highlight="var(--approval)"
                        />
                    </Cell>
                </Row>
            </Spec>

            <Spec
                name="GradientMark"
                note="an entity's generated avatar - its letter on the AI-chosen gradient, or a deterministic fallback."
            >
                <Row className="gap-6">
                    {ENTITIES.map((e) => (
                        <Cell key={e.name} label={e.name}>
                            <GradientMark name={e.name} branding={e.branding} size={44} />
                        </Cell>
                    ))}
                </Row>
                <Row className="mt-6 gap-6">
                    <Cell label="size={24}">
                        <GradientMark name="Ledgerly" size={24} />
                    </Cell>
                    <Cell label="size={32} (rail default)">
                        <GradientMark name="Ledgerly" size={32} />
                    </Cell>
                    <Cell label="size={56} radius={28}">
                        <GradientMark name="Ledgerly" size={56} radius={28} />
                    </Cell>
                </Row>
                <Note>
                    No branding row yet? It falls back to the first letter and{" "}
                    <code>paletteFor(name)</code>, so a draft still gets a stable gradient.
                </Note>
            </Spec>

            <Spec
                name="PALETTES · paletteFor"
                note="six deterministic gradients; paletteFor hashes a seed into one of them."
            >
                <Row className="gap-4">
                    {PALETTES.map((p, i) => (
                        <Cell key={p[0]} label={`PALETTES[${i}]`}>
                            <span
                                className="block size-12 rounded-xl"
                                style={{ background: `linear-gradient(145deg, ${p[0]}, ${p[1]})` }}
                            />
                        </Cell>
                    ))}
                </Row>
                <Api
                    items={[
                        {
                            name: 'paletteFor("Ledgerly")',
                            note: "stable per seed - the same name always draws the same gradient.",
                            value: paletteFor("Ledgerly").join(" → "),
                        },
                        {
                            name: 'paletteFor("Quietbill")',
                            note: "a different seed, a different pair.",
                            value: paletteFor("Quietbill").join(" → "),
                        },
                    ]}
                />
            </Spec>

            <Spec
                name="ProviderLogo"
                note="model-provider marks. Colour brands draw in their own colour; monochrome ones inherit currentColor."
            >
                <Row className="gap-8">
                    {PROVIDERS.map((id) => (
                        <Cell key={id} label={id}>
                            <ProviderLogo id={id} className="size-7" />
                        </Cell>
                    ))}
                </Row>
            </Spec>
        </>
    );
}
