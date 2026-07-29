import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertCanImport, ForbiddenError } from "@/lib/permissions";
import { parseSheetForPreview, HeaderNotDetectedError } from "@/lib/excelImport/parseWorkbook";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    assertCanImport(session.user);

    const formData = await req.formData();
    const file = formData.get("file");
    const sheetName = formData.get("sheetName");
    if (!(file instanceof File) || typeof sheetName !== "string") {
      return NextResponse.json({ error: "Archivo o nombre de hoja no proporcionado" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = parseSheetForPreview(buffer, sheetName);

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof HeaderNotDetectedError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "No se pudo procesar el archivo." }, { status: 400 });
  }
}
