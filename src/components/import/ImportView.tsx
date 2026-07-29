"use client";

import { useState } from "react";
import type { Sucursal } from "@prisma/client";
import type { PreviewResult } from "@/lib/excelImport/parseWorkbook";
import { SheetPicker } from "./SheetPicker";
import { ImportPreviewTable } from "./ImportPreviewTable";

export function ImportView() {
  const [file, setFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[] | null>(null);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [overrides, setOverrides] = useState<Record<number, Sucursal | "exclude">>({});
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setSheetNames(null);
    setSelectedSheet("");
    setPreview(null);
    setOverrides({});
    setImportedCount(null);
    setError(null);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    reset();
    setFile(selected);
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selected);
      const res = await fetch("/api/import/sheets", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo leer el archivo.");

      const names: string[] = body.sheetNames;
      setSheetNames(names);
      if (names.length === 1) {
        setSelectedSheet(names[0]);
        await runPreview(selected, names[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al leer el archivo.");
    } finally {
      setLoading(false);
    }
  }

  async function runPreview(targetFile: File, sheetName: string) {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", targetFile);
      formData.append("sheetName", sheetName);
      const res = await fetch("/api/import/preview", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo procesar la hoja.");
      setPreview(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar la hoja.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setConfirming(true);
    setError(null);

    const rows = preview.rows
      .map((row) => {
        const sucursal = row.sucursal ?? overrides[row.rowIndex];
        if (!sucursal || sucursal === "exclude") return null;
        return {
          fecha: row.fecha,
          nombre: row.nombre,
          telefono: row.telefono,
          interes: row.interes,
          fuente: row.fuente,
          sucursal,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    try {
      const res = await fetch("/api/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo importar.");
      setImportedCount(body.imported);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al importar.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Archivo Excel (.xlsx / .xls)
        </label>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="text-sm"
        />
      </div>

      {loading && <p className="text-sm text-slate-500">Procesando…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {sheetNames && sheetNames.length > 1 && !preview && (
        <SheetPicker
          sheetNames={sheetNames}
          value={selectedSheet}
          onChange={setSelectedSheet}
          onConfirm={() => file && runPreview(file, selectedSheet)}
        />
      )}

      {preview && (
        <ImportPreviewTable
          preview={preview}
          overrides={overrides}
          onOverrideChange={(rowIndex, value) => setOverrides((prev) => ({ ...prev, [rowIndex]: value }))}
          onConfirm={handleConfirm}
          confirming={confirming}
          importedCount={importedCount}
        />
      )}
    </div>
  );
}
