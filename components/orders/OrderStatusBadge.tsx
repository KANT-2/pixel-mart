interface OrderStatusBadgeProps {
  status: string;
  label: string;
}

const statusColors: Record<string, string> = {
  paid: "border-violet/30 bg-violet/10 text-violet",
  preparing: "border-mint/30 bg-mint/10 text-mint",
  shipping: "border-lime/30 bg-lime/10 text-lime",
  delivered: "border-line bg-panel-2 text-ink",
  cancel_requested: "border-pink/30 bg-pink/10 text-pink",
  cancelled: "border-line bg-panel-2 text-dim",
};

export default function OrderStatusBadge({ status, label }: OrderStatusBadgeProps) {
  return <span className={`inline-flex shrink-0 items-center rounded-md border px-2.5 py-1 text-xs font-bold ${statusColors[status] ?? "border-line bg-panel-2 text-sub"}`}>{label}</span>;
}
