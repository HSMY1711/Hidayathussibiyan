import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, ConfirmDialog, StatusBadge, LoadingRows } from './ui';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, RefreshCw, Trash2, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useOutletContext } from 'react-router';

const KIND_LABEL: Record<string, string> = { team: 'Team / Group', participants: 'Participant Competitions', judges: 'Judge Marking Sheets' };

export default function Documents() {
  const { locked } = useOutletContext<{ locked: boolean }>();
  const [rows, setRows] = useState<any[] | null>(null);
  const [deleting, setDeleting] = useState<any>(null);

  const load = () => api.get('/api/admin/pdfs').then((d) => setRows(d.pdfs));
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  const toggle = async (r: any) => {
    try {
      await api.put(`/api/admin/pdfs/${r.id}`, { published: !r.published });
      toast.success(r.published ? 'Document unpublished — hidden from the public page.' : 'Document published to the public page.');
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const regenerate = async (r: any) => {
    try {
      await api.post(`/api/admin/pdfs/${r.id}/regenerate`);
      toast.success('PDF regenerated with the latest data.');
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const doDelete = async () => {
    try {
      await api.del(`/api/admin/pdfs/${deleting.id}`);
      toast.success('Document removed.');
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const renderRow = (r: any, mobile = false) => mobile ? (
    <Card key={r.id} className="stat-card">
      <CardContent className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{r.title}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{KIND_LABEL[r.kind]} · updated {String(r.updated_at).replace('T', ' ').slice(0, 16)}</div>
          </div>
          <StatusBadge on={!!r.published} onLabel="Public" offLabel="Private" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={`/api/admin/pdfs/${r.id}/file`} target="_blank" rel="noreferrer"
            className="flex h-10 items-center justify-center gap-1.5 rounded-sm border border-border text-sm font-medium hover:bg-muted">
            <Eye className="h-4 w-4" /> View
          </a>
          <Button variant="outline" size="sm" className="h-10" onClick={() => regenerate(r)} disabled={locked}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Update
          </Button>
          <Button variant="outline" size="sm" className="h-10" onClick={() => toggle(r)} disabled={locked}>
            <Globe className="mr-1.5 h-4 w-4" /> {r.published ? 'Unpublish' : 'Publish'}
          </Button>
          <Button variant="outline" size="sm" className="h-10 text-destructive" onClick={() => setDeleting(r)} disabled={locked}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  ) : (
    <TableRow key={r.id}>
      <TableCell>
        <div className="font-medium">{r.title}</div>
        <div className="text-xs text-muted-foreground">{KIND_LABEL[r.kind]}</div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{String(r.updated_at).replace('T', ' ').slice(0, 16)}</TableCell>
      <TableCell><StatusBadge on={!!r.published} onLabel="Published" offLabel="Private / Draft" /></TableCell>
      <TableCell className="text-right">
        <div className="inline-flex flex-wrap justify-end gap-1">
          <a href={`/api/admin/pdfs/${r.id}/file`} target="_blank" rel="noreferrer"
            className="flex h-9 items-center gap-1.5 rounded-sm border border-border px-2.5 text-sm font-medium hover:bg-muted">
            <Eye className="h-4 w-4" /> View
          </a>
          <Button variant="outline" size="sm" className="h-9" onClick={() => regenerate(r)} disabled={locked}>Update</Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => toggle(r)} disabled={locked}>
            {r.published ? 'Unpublish' : 'Publish'}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => setDeleting(r)} disabled={locked} aria-label={`Remove ${r.title}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div>
      <PageHeader
        title="Published Documents"
        desc="Saved PDFs. Only published documents appear on the public Jashne Rabeeh page — visitors can view but not edit or download them. Regenerate to refresh with the latest data."
      />
      <div className="hidden overflow-x-auto rounded-sm border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead><TableHead>Updated</TableHead><TableHead>Visibility</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!rows ? <LoadingRows cols={4} rows={5} /> : rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="py-10 text-center text-sm italic text-muted-foreground">No PDFs generated yet — use PDF Generation.</TableCell></TableRow>
            ) : rows.map((r) => renderRow(r))}
          </TableBody>
        </Table>
      </div>
      <div className="space-y-2 md:hidden">
        {!rows ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-sm bg-muted" />)
          : rows.length === 0 ? <p className="py-10 text-center text-sm italic text-muted-foreground">No PDFs generated yet.</p>
          : rows.map((r) => renderRow(r, true))}
      </div>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title="Remove document?"
        description={`This permanently deletes “${deleting?.title}”. If it was published, it disappears from the public page immediately.`}
        onConfirm={doDelete}
      />
    </div>
  );
}
