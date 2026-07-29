export function SheetPicker({
  sheetNames,
  value,
  onChange,
  onConfirm,
}: {
  sheetNames: string[];
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-700">
        Este archivo tiene varias hojas. Elige cuál importar:
      </p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        {sheetNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <button
        onClick={onConfirm}
        className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Continuar
      </button>
    </div>
  );
}
