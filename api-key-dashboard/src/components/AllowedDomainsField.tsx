import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { parseAllowedDomains, normalizeAllowedDomains } from "@/api/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AllowedDomainsFieldProps = {
  label: string;
  value: string[];
  editing: boolean;
  onChange: (domains: string[]) => void;
  onInvalid?: (message: string) => void;
  placeholder?: string;
  hint?: string;
};

export function AllowedDomainsField({
  label,
  value,
  editing,
  onChange,
  onInvalid,
  placeholder = "example.com, api.example.com",
  hint = "Press Enter or type a comma to add each domain.",
}: AllowedDomainsFieldProps) {
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setDraft("");
  }, [value, editing]);

  const displayValue = useMemo(() => value.join(", "), [value]);

  const commitDraft = () => {
    const parsed = parseAllowedDomains(draft);
    if (parsed.invalid.length > 0) {
      onInvalid?.(`Invalid domain: ${parsed.invalid[0]}`);
      return;
    }

    if (parsed.domains.length === 0) {
      setDraft("");
      return;
    }

    onChange(normalizeAllowedDomains([...value, ...parsed.domains]));
    setDraft("");
  };

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-4 border-b border-border py-1.5 last:border-0">
        <Label className="pt-1 text-muted-foreground">{label}</Label>
        <span className="max-w-[240px] text-right text-foreground">
          {displayValue || "—"}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-b border-border py-1.5 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <Label className="pt-2 text-muted-foreground">{label}</Label>
        <div className="flex-1 space-y-2">
          <div className="flex min-h-9 flex-wrap items-center gap-2 rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
            {value.map((domain) => (
              <span
                key={domain}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 text-xs text-foreground"
              >
                {domain}
                <button
                  type="button"
                  aria-label={`Remove ${domain}`}
                  className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted-foreground/10 hover:text-foreground"
                  onClick={() => onChange(value.filter((item) => item !== domain))}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <Input
              value={draft}
              onChange={(e) => {
                const next = e.target.value;
                if (next.includes(",")) {
                  const parsed = parseAllowedDomains(next);
                  if (parsed.invalid.length === 0 && parsed.domains.length > 0) {
                    onChange(normalizeAllowedDomains([...value, ...parsed.domains]));
                    setDraft("");
                    return;
                  }
                }
                setDraft(next);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  commitDraft();
                }
                if (e.key === "Backspace" && !draft && value.length > 0) {
                  onChange(value.slice(0, -1));
                }
              }}
              onBlur={() => commitDraft()}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (!text.includes(",")) {
                  return;
                }

                e.preventDefault();
                const parsed = parseAllowedDomains(text);
                if (parsed.invalid.length > 0) {
                  onInvalid?.(`Invalid domain: ${parsed.invalid[0]}`);
                  return;
                }
                if (parsed.domains.length > 0) {
                  onChange(normalizeAllowedDomains([...value, ...parsed.domains]));
                  setDraft("");
                }
              }}
              placeholder={placeholder}
              className="h-7 min-w-[140px] flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
            />
          </div>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
    </div>
  );
}