import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertCanImport, ForbiddenError } from "@/lib/permissions";
import { listSheetNames } from "@/lib/excelImport/parseWorkbook";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    assertCanImport(session.user);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Archivo no proporcionado" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sheetNames = listSheetNames(buffer);

    return NextResponse.json({ sheetNames });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "No se pudo leer el archivo. Verifica que sea un .xlsx o .xls válido." },
      { status: 400 }
    );
  }
}
