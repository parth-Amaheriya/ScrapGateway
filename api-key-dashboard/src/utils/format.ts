export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatPercent(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function maskKey(key: string): string {
  if (key.length < 12) return key;
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

export function statusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-success/15 text-success border-success/30";
    case "paused":
      return "bg-warning/15 text-warning-foreground border-warning/40";
    case "revoked":
      return "bg-destructive/15 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
