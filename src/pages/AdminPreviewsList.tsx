import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Copy,
  ExternalLink,
  Archive,
  ArchiveRestore,
  Send,
  RotateCcw,
  Trash2,
  Mail,
  Phone,
  Check,
} from "lucide-react";

type PreviewRow = {
  id: string;
  handle: string;
  name: string;
  city: string;
  photo_urls: string[];
  claimed_by_user_id: string | null;
  dm_sent_at: string | null;
  archived_at: string | null;
  created_at: string;
};

type ClaimRow = {
  id: string;
  preview_page_id: string;
  email: string;
  phone: string | null;
  contacted_at: string | null;
  created_at: string;
  preview_pages?: { name: string; handle: string } | null;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

const AdminPreviewsList = () => {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [previews, setPreviews] = useState<PreviewRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [claimCounts, setClaimCounts] = useState<Record<string, number>>({});
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const previewsQuery = supabase
        .from("preview_pages")
        .select("id,handle,name,city,photo_urls,claimed_by_user_id,dm_sent_at,archived_at,created_at")
        .order("created_at", { ascending: false });

      const filtered = showArchived
        ? previewsQuery.not("archived_at", "is", null)
        : previewsQuery.is("archived_at", null);

      const [{ data: previewsData, error: previewsErr }, { data: claimsData, error: claimsErr }, { data: allClaims }] =
        await Promise.all([
          filtered,
          supabase
            .from("preview_page_claims")
            .select("id, preview_page_id, email, phone, contacted_at, created_at, preview_pages(name, handle)")
            .is("contacted_at", null)
            .order("created_at", { ascending: false }),
          supabase.from("preview_page_claims").select("preview_page_id"),
        ]);

      if (previewsErr) throw previewsErr;
      if (claimsErr) throw claimsErr;

      setPreviews((previewsData ?? []) as PreviewRow[]);
      setClaims((claimsData ?? []) as ClaimRow[]);

      const counts: Record<string, number> = {};
      for (const c of (allClaims ?? []) as { preview_page_id: string }[]) {
        counts[c.preview_page_id] = (counts[c.preview_page_id] ?? 0) + 1;
      }
      setClaimCounts(counts);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load previews.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, showArchived]);

  const copyLink = async (handle: string) => {
    const url = `${window.location.origin}/preview/${handle}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  const toggleSent = async (row: PreviewRow) => {
    setBusyId(row.id);
    const next = row.dm_sent_at ? null : new Date().toISOString();
    const { error } = await supabase.from("preview_pages").update({ dm_sent_at: next }).eq("id", row.id);
    setBusyId(null);
    if (error) {
      toast.error("Failed to update");
      return;
    }
    toast.success(next ? "Marked as sent" : "Marked as unsent");
    fetchAll();
  };

  const archive = async (row: PreviewRow) => {
    setBusyId(row.id);
    const { error } = await supabase
      .from("preview_pages")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", row.id);
    setBusyId(null);
    if (error) {
      toast.error("Failed to archive");
      return;
    }
    toast.success("Archived");
    fetchAll();
  };

  const unarchive = async (row: PreviewRow) => {
    setBusyId(row.id);
    const { error } = await supabase.from("preview_pages").update({ archived_at: null }).eq("id", row.id);
    setBusyId(null);
    if (error) {
      toast.error("Failed to unarchive");
      return;
    }
    toast.success("Unarchived");
    fetchAll();
  };

  const hardDelete = async (row: PreviewRow) => {
    setBusyId(row.id);
    const { error } = await supabase.from("preview_pages").delete().eq("id", row.id);
    setBusyId(null);
    if (error) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Deleted permanently");
    fetchAll();
  };

  const markContacted = async (claim: ClaimRow) => {
    setBusyId(claim.id);
    const { error } = await supabase
      .from("preview_page_claims")
      .update({ contacted_at: new Date().toISOString() })
      .eq("id", claim.id);
    setBusyId(null);
    if (error) {
      toast.error("Failed to update");
      return;
    }
    toast.success("Marked contacted");
    fetchAll();
  };

  const getStatus = (row: PreviewRow): { label: string; className: string } => {
    if (row.claimed_by_user_id)
      return { label: "Claimed", className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" };
    if (row.dm_sent_at)
      return { label: "Sent", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" };
    return { label: "Draft", className: "bg-muted text-muted-foreground hover:bg-muted" };
  };

  const pendingClaims = useMemo(() => claims, [claims]);

  if (roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Preview pages</h1>
            <p className="text-sm text-muted-foreground">
              Manage outreach assets, track DMs, and review claims.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
              <Label htmlFor="show-archived" className="text-sm">
                Show archived
              </Label>
            </div>
            <Button asChild>
              <Link to="/admin/new-preview">
                <Plus className="mr-2 h-4 w-4" /> New preview
              </Link>
            </Button>
          </div>
        </div>

        {/* Pending claims */}
        {!showArchived && pendingClaims.length > 0 && (
          <Card className="mb-6 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Pending claims ({pendingClaims.length})
            </h2>
            <div className="divide-y">
              {pendingClaims.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {c.preview_pages?.name ?? "Unknown preview"}{" "}
                      {c.preview_pages?.handle && (
                        <a
                          href={`/preview/${c.preview_pages.handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                        >
                          /{c.preview_pages.handle}
                        </a>
                      )}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" /> {c.email}
                      </span>
                      {c.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" /> {c.phone}
                        </span>
                      )}
                      <span>{formatDate(c.created_at)}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markContacted(c)}
                    disabled={busyId === c.id}
                  >
                    <Check className="mr-1.5 h-4 w-4" />
                    Mark contacted
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Previews list */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : previews.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {showArchived ? "No archived previews." : "No previews yet."}
            </div>
          ) : (
            <ul className="divide-y">
              {previews.map((row) => {
                const status = getStatus(row);
                const claimCount = claimCounts[row.id] ?? 0;
                const canHardDelete = !row.dm_sent_at && claimCount === 0;
                return (
                  <li key={row.id} className="flex flex-wrap items-center gap-4 p-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                      {row.photo_urls?.[0] ? (
                        <img
                          src={row.photo_urls[0]}
                          alt={row.name}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{row.name}</p>
                        <Badge variant="secondary" className={status.className}>
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{row.city}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <a
                          href={`/preview/${row.handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                        >
                          /preview/{row.handle}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <span>·</span>
                        <span>Created {formatDate(row.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyLink(row.handle)}
                        title="Copy link"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>

                      {!showArchived && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleSent(row)}
                            disabled={busyId === row.id}
                          >
                            {row.dm_sent_at ? (
                              <>
                                <RotateCcw className="mr-1.5 h-4 w-4" /> Mark unsent
                              </>
                            ) : (
                              <>
                                <Send className="mr-1.5 h-4 w-4" /> Mark sent
                              </>
                            )}
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" disabled={busyId === row.id}>
                                <Archive className="mr-1.5 h-4 w-4" /> Archive
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Archive this preview?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  The page will be hidden from the active list but the public URL{" "}
                                  <code>/preview/{row.handle}</code> will keep working so any DM'd
                                  link won't 404.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => archive(row)}>
                                  Archive
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}

                      {showArchived && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => unarchive(row)}
                            disabled={busyId === row.id}
                          >
                            <ArchiveRestore className="mr-1.5 h-4 w-4" /> Unarchive
                          </Button>

                          {canHardDelete ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive" disabled={busyId === row.id}>
                                  <Trash2 className="mr-1.5 h-4 w-4" /> Delete permanently
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This cannot be undone. The preview page and its URL will be
                                    gone forever. Only available because no DM was sent and no
                                    claims exist.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => hardDelete(row)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete forever
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button size="sm" variant="destructive" disabled>
                                    <Trash2 className="mr-1.5 h-4 w-4" /> Delete permanently
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Archive only — has outreach history or claims.
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default AdminPreviewsList;
