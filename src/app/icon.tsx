import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const logo = await readFile(join(process.cwd(), "public/images/Logotipo Activant.png"));
  return new ImageResponse(
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", background: "white" }}>
      {/* ImageResponse necesita una imagen nativa; conserva el logotipo completo. */}
      <img src={`data:image/png;base64,${logo.toString("base64")}`} alt="" width={60} height={60 * 836 / 1881} />
    </div>,
    size,
  );
}
