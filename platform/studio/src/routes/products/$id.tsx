import { createFileRoute, Outlet, useNavigate, useRouterState, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getProjectData } from "~/lib/project-fns";
import { getProduct } from "~/lib/product-fns";
import type { Project, Product } from "~/db/schema";
import { Button } from "~/components/ui/Button";
import { ProjectConfigModal } from "~/components/ui/ProjectConfigModal";
import { ProjectCtx } from "~/lib/project-context";
import { LayoutDashboard, Hammer, Send, BarChart2, FileText, ExternalLink, ArrowLeft } from "lucide-react";

// Shared presentational helper re-used by product sub-pages (build/measure import this).
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.60rem] font-bold tracking-widest uppercase text-fg-subtle block mb-[10px]">
      {children}
    </span>
  );
}

const STEPS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "spec", label: "Spec", icon: FileText },
  { key: "build", label: "Build", icon: Hammer },
  { key: "distribution", label: "Distribution", icon: Send },
  { key: "measure", label: "Monitor", icon: BarChart2 },
] as const;

export const Route = createFileRoute("/products/$id")({
  loader: async ({ params }) => {
    const productId = parseInt(params.id, 10);
    const product = await getProduct({ data: { id: productId } });
    if (!product) throw new Error("Product not found");
    const ideaData = await getProjectData({ data: { id: product.ideaId } });
    return {
      product,
      project: ideaData?.project ?? null,
      stats: ideaData?.stats ?? { signalCount: 0, opportunityCount: 0, featureCount: 0, discoveryRunCount: 0 },
      scores: ideaData?.scores ?? [],
      funnel: ideaData?.funnel ?? [],
      activeChannels: ideaData?.activeChannels ?? [],
    };
  },
  staleTime: 30_000,
  component: ProductLayout,
});

function ProductTabs({ productId }: { productId: string }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/products/${productId}`;
  return (
    <div className="flex border-b border-border flex-shrink-0 overflow-x-auto">
      {STEPS.map(({ key, label, icon: Icon }) => {
        const targetPath = key === "overview" ? base : `${base}/${key}`;
        const isActive = key === "overview"
          ? pathname === base || pathname === `${base}/`
          : pathname.startsWith(targetPath);
        return (
          <Button
            key={key}
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: targetPath as any })}
            style={{
              gap: 7, padding: "0 22px", height: 46,
              background: isActive ? "rgba(165,182,214,0.05)" : "transparent",
              borderBottom: `2px solid ${isActive ? "var(--accent)" : "transparent"}`,
              borderRadius: 0,
              color: isActive ? "var(--fg)" : "var(--fg-subtle)",
              fontSize: "0.84rem", fontWeight: isActive ? 600 : 400,
              letterSpacing: "0.03em", flexShrink: 0,
            }}
          >
            <Icon size={13} />
            {label}
          </Button>
        );
      })}
    </div>
  );
}

function ProductLayout() {
  const { product: initialProduct, project: initialProject, stats, scores, funnel, activeChannels } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(initialProduct);
  useEffect(() => { setProduct(initialProduct); }, [initialProduct.id]);

  // The idea behind this product (discovery context). Product pages read `project` from ctx.
  const [project, setProjectState] = useState<Project>(initialProject ?? (initialProduct as unknown as Project));
  useEffect(() => { if (initialProject) setProjectState(initialProject); }, [initialProduct.id]);
  const setProject = setProjectState as ProjectContextSetProject;

  const [channels, setChannels] = useState(activeChannels);
  useEffect(() => { setChannels(activeChannels); }, [initialProduct.id]);

  const [configOpen, setConfigOpen] = useState(false);

  return (
    <ProjectCtx.Provider value={{ project, setProject, product, setProduct, channels, setChannels, stats, scores, funnel }}>
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <div className="px-5 h-[40px] border-b border-border flex items-center gap-[10px] flex-shrink-0 bg-bg">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/i/$id", params: { id: String(product?.ideaId ?? "") } })} title="Back to idea" style={{ color: "var(--fg-dim)", padding: "2px 4px", height: "auto" }}>
            <ArrowLeft size={14} />
          </Button>
          <span className="text-base font-semibold text-fg flex-shrink-0">{product?.name}</span>
          {product?.deployStatus === "deployed" && (
            <span style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--success)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 3, padding: "1px 5px" }}>live</span>
          )}
          {product?.domain && (
            <a href={`https://${product.domain}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.78rem", color: "rgba(165,182,214,0.6)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
              {product.domain} <ExternalLink size={11} />
            </a>
          )}
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)} style={{ fontSize: "0.76rem" }}>Configure</Button>
        </div>
        <ProductTabs productId={String(initialProduct.id)} />
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
      <ProjectConfigModal open={configOpen} project={{ id: product?.ideaId ?? 0 }} onClose={() => setConfigOpen(false)} onSaved={() => router.invalidate()} />
    </ProjectCtx.Provider>
  );
}

type ProjectContextSetProject = React.Dispatch<React.SetStateAction<Project>>;
