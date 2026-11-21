import { FILTERS } from "@/utils/filters";

/** Horizontal Instagram-style filter picker. Tiles show the actual picture with each look applied. */
const FilterStrip = ({ value, onChange, thumb }: { value: string; onChange: (css: string) => void; thumb?: string | null }) => (
  <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1">
    {FILTERS.map((f) => {
      const on = value === f.css;
      return (
        <button key={f.name} type="button" onClick={() => onChange(f.css)} className="flex w-16 shrink-0 flex-col items-center gap-1">
          <span className={`block h-16 w-16 overflow-hidden rounded-xl ring-2 ${on ? "ring-primary" : "ring-transparent"}`}>
            {thumb
              ? <img src={thumb} alt="" className="h-full w-full object-cover" style={{ filter: f.css }} />
              : <span className="block h-full w-full bg-gradient-to-br from-sky-400 via-fuchsia-400 to-amber-300" style={{ filter: f.css }} />}
          </span>
          <span className={`text-[10px] ${on ? "font-semibold text-primary" : "text-muted-foreground"}`}>{f.name}</span>
        </button>
      );
    })}
  </div>
);
export default FilterStrip;
