import { type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-2xl md:text-[28px] font-semibold tracking-tight">{title}</h1>
      {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      <div className="gold-rule mt-4" />
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function StatusBadge({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return (
    <span
      className="inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-medium tracking-wide"
      style={on
        ? { background: 'hsl(150 30% 92%)', color: 'hsl(155 45% 22%)', borderColor: 'hsl(150 20% 75%)' }
        : { background: 'hsl(45 20% 93%)', color: 'hsl(40 15% 38%)', borderColor: 'hsl(45 10% 78%)' }}
    >
      {on ? onLabel : offLabel}
    </span>
  );
}

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel = 'Delete', onConfirm, destructive = true,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string; description: string;
  confirmLabel?: string; onConfirm: () => void; destructive?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => { onConfirm(); onOpenChange(false); }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LoadingRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-border">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-3 py-3">
              <div className="h-3.5 animate-pulse rounded bg-muted" style={{ width: `${55 + ((i * 17 + j * 29) % 40)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
