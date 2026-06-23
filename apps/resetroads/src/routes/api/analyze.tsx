import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/analyze") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { db } = await import("../../db/client");
        const { analyses } = await import("../../db/schema");
        const { extractTextFromBuffer, extractProfile, analyzeGap } = await import("../../lib/cv-parser");
        const { nanoid } = await import("../../lib/nanoid");

        let cvText = "";
        let cvFilename: string | null = null;
        let decisionType = "";
        let decisionDetail: string | null = null;

        const contentType = request.headers.get("content-type") ?? "";

        if (contentType.includes("multipart/form-data")) {
          const form = await request.formData();
          const file = form.get("cv") as File | null;
          decisionType = (form.get("decisionType") as string) ?? "";
          decisionDetail = (form.get("decisionDetail") as string) || null;

          if (file && file.size > 0) {
            cvFilename = file.name;
            const buf = Buffer.from(await file.arrayBuffer());
            cvText = await extractTextFromBuffer(buf, file.type);
          }
        } else {
          const body = await request.json();
          cvText = body.cvText ?? "";
          decisionType = body.decisionType ?? "";
          decisionDetail = body.decisionDetail ?? null;
          cvFilename = body.cvFilename ?? null;
        }

        if (!cvText.trim()) {
          return new Response(JSON.stringify({ error: "No CV text found" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!["offer", "freelance", "pivot", "salary", "other"].includes(decisionType)) {
          return new Response(JSON.stringify({ error: "Invalid decision type" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const profile = await extractProfile(cvText);

        let gapRows = null;
        let gapJdTitle: string | null = null;
        if (decisionType === "offer" && decisionDetail) {
          const gap = await analyzeGap(cvText, decisionDetail);
          gapRows = gap.rows;
          gapJdTitle = gap.jdTitle;
        }

        const id = nanoid();
        const ownerToken = nanoid();

        await db.insert(analyses).values({
          id,
          ownerToken,
          decisionType: decisionType as any,
          decisionDetail,
          cvFilename,
          cvText,
          profile,
          gapAnalysis: gapRows,
          gapJdTitle,
        });

        const cookie = `rr_own_${id}=${ownerToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`;

        return new Response(
          JSON.stringify({ id, profile, gapAnalysis: gapRows, gapJdTitle }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": cookie,
            },
          }
        );
      },
    },
  },
});
