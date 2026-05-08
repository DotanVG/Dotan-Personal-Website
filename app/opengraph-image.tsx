import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Dotan Veretzky — Software Engineer & Indie Game Developer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          color: "#f5f5f5",
          background:
            "radial-gradient(80% 60% at 80% 10%, rgba(250, 204, 21, 0.35) 0%, transparent 60%), radial-gradient(60% 60% at 10% 90%, rgba(167, 139, 250, 0.30) 0%, transparent 60%), #0a0a0a",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 22,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#a3a3a3",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: "#22c55e",
              boxShadow: "0 0 18px #22c55e",
            }}
          />
          <span>dotanv · vercel · app</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 132,
              lineHeight: 0.95,
              fontWeight: 700,
              letterSpacing: -4,
            }}
          >
            Dotan
            <br />
            Veretzky.
          </div>
          <div
            style={{
              fontSize: 38,
              color: "#d4d4d4",
              fontWeight: 400,
              maxWidth: 920,
            }}
          >
            Software Engineer · Indie Game Developer
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 24,
            color: "#a3a3a3",
          }}
        >
          <div>A portfolio you can read — or walk through.</div>
          <div style={{ color: "#facc15" }}>?mode=explore →</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
