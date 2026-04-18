import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Copy, Check, Loader2, ExternalLink } from "lucide-react";

// Pre-seeded Dublin barber service defaults — admin can edit/add/remove.
const DEFAULT_SERVICES = [
  { name: "Skin Fade", price_from: 25, duration_mins: 30 },
  { name: "Dry Cut", price_from: 20, duration_mins: 30 },
  { name: "Beard Trim", price_from: 12, duration_mins: 15 },
  { name: "Hot Towel Shave", price_from: 25, duration_mins: 30 },
  { name: "Kids Cut", price_from: 15, duration_mins: 20 },
  { name: "Wash & Style", price_from: 18, duration_mins: 25 },
];

type ServiceRow = { name: string; price_from: number; duration_mins: number };

const handleSlugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);

const AdminNewPreview = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: roleLoading } = useUserRole();

  const [name, setName] = useState("");
  const [city, setCity] = useState("Dublin");
  const [handle, setHandle] = useState("");
  const [handleEdited, setHandleEdited] = useState(false);
  const [instagramHandle, setInstagramHandle] = useState("");
  const [tagline, setTagline] = useState("");
  const [website, setWebsite] = useState("");
  const [bio, setBio] = useState("");
  const [services, setServices] = useState<ServiceRow[]>(DEFAULT_SERVICES);
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createdHandle, setCreatedHandle] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Admin gate
  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast({ title: "Admin only", description: "Redirecting…", variant: "destructive" });
      navigate("/", { replace: true });
    }
  }, [isAdmin, roleLoading, navigate, toast]);

  // Auto-generate handle from name until user manually edits it
  useEffect(() => {
    if (!handleEdited) setHandle(handleSlugify(name));
  }, [name, handleEdited]);

  const addService = () => {
    if (services.length >= 10) return;
    setServices([...services, { name: "", price_from: 0, duration_mins: 30 }]);
  };
  const updateService = (i: number, patch: Partial<ServiceRow>) => {
    setServices(services.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };
  const removeService = (i: number) => setServices(services.filter((_, idx) => idx !== i));

  const onPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setPhotos(files.slice(0, 6));
  };

  const validate = (): string | null => {
    if (!name.trim()) return "Name is required";
    if (!city.trim()) return "City is required";
    if (!handle.trim() || !/^[a-z0-9-]+$/.test(handle)) return "Handle must be lowercase letters, numbers, and dashes";
    if (!instagramHandle.trim()) return "Instagram handle is required";
    if (!tagline.trim()) return "Tagline is required";
    if (tagline.length > 80) return "Tagline must be 80 characters or fewer";
    if (website && !/^https?:\/\//.test(website)) return "Website must start with http:// or https://";
    if (bio.length > 280) return "Bio must be 280 characters or fewer";
    if (services.some((s) => !s.name.trim() || s.price_from < 0 || s.duration_mins <= 0))
      return "Every service needs a name, non-negative price, and positive duration";
    if (photos.length < 3 || photos.length > 6) return "Upload between 3 and 6 photos";
    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast({ title: "Fix this first", description: err, variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      // Unique handle pre-check
      const { data: existing } = await supabase
        .from("preview_pages")
        .select("id")
        .eq("handle", handle)
        .maybeSingle();
      if (existing) {
        toast({ title: "Handle taken", description: "Pick a different URL slug.", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload photos
      const photoUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const file = photos[i];
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `preview-pages/${handle}/${i}-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("profile-images")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("profile-images").getPublicUrl(path);
        photoUrls.push(urlData.publicUrl);
      }

      const igClean = instagramHandle.replace(/^@/, "").trim();

      const { error: insertErr } = await supabase.from("preview_pages").insert({
        handle,
        name: name.trim(),
        city: city.trim(),
        instagram_handle: igClean,
        tagline: tagline.trim(),
        website: website.trim() || null,
        bio: bio.trim() || null,
        services: services as any,
        photo_urls: photoUrls,
        created_by: user.id,
      });
      if (insertErr) throw insertErr;

      setCreatedHandle(handle);
      toast({ title: "Preview created", description: `/preview/${handle} is live.` });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Failed to create", description: e.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const previewUrl = createdHandle ? `${window.location.origin}/preview/${createdHandle}` : "";
  const copyUrl = async () => {
    await navigator.clipboard.writeText(previewUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin) return null;

  // Success view
  if (createdHandle) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Check className="h-6 w-6 text-primary" />
          </div>
          <h1 className="mb-2 text-2xl font-semibold">Preview page created</h1>
          <p className="mb-6 text-sm text-muted-foreground">Send this link in your outreach.</p>
          <div className="mb-4 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <span className="flex-1 truncate text-left font-mono">{previewUrl}</span>
            <Button size="sm" variant="ghost" onClick={copyUrl}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex justify-center gap-3">
            <Button onClick={() => navigate(`/preview/${createdHandle}`)}>
              <ExternalLink className="mr-2 h-4 w-4" /> View page
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCreatedHandle(null);
                setName("");
                setHandle("");
                setHandleEdited(false);
                setInstagramHandle("");
                setTagline("");
                setWebsite("");
                setBio("");
                setServices(DEFAULT_SERVICES);
                setPhotos([]);
              }}
            >
              Create another
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">New preview page</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Hand-craft an outreach asset. Goes live at <code>/preview/{handle || "{handle}"}</code>.
      </p>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card className="space-y-4 p-6">
          <div>
            <Label htmlFor="name">Display name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Marco Russo" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">City *</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
            </div>
            <div>
              <Label htmlFor="handle">URL handle *</Label>
              <Input
                id="handle"
                value={handle}
                onChange={(e) => {
                  setHandleEdited(true);
                  setHandle(handleSlugify(e.target.value));
                }}
                maxLength={40}
                placeholder="marco-cuts"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="ig">Instagram handle *</Label>
            <Input
              id="ig"
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value)}
              maxLength={31}
              placeholder="marco.cuts"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <Label htmlFor="tagline">Tagline *</Label>
              <span className={`text-xs ${tagline.length > 80 ? "text-destructive" : "text-muted-foreground"}`}>
                {tagline.length}/80
              </span>
            </div>
            <Input
              id="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={80}
              placeholder="Sharp fades and classic cuts in the heart of Dublin."
            />
          </div>

          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              maxLength={200}
              placeholder="https://example.com"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <Label htmlFor="bio">Bio</Label>
              <span className="text-xs text-muted-foreground">{bio.length}/280</span>
            </div>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Marco has been cutting hair in Dublin for over a decade…"
            />
          </div>
        </Card>

        <Card className="space-y-3 p-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Services *</Label>
              <p className="text-xs text-muted-foreground">Pre-seeded with Dublin barber defaults — edit as needed.</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={addService} disabled={services.length >= 10}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {services.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_80px_auto] items-center gap-2">
                <Input
                  value={s.name}
                  onChange={(e) => updateService(i, { name: e.target.value })}
                  placeholder="Service name"
                  maxLength={40}
                />
                <Input
                  type="number"
                  min={0}
                  value={s.price_from}
                  onChange={(e) => updateService(i, { price_from: Number(e.target.value) })}
                  placeholder="€"
                />
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={s.duration_mins}
                  onChange={(e) => updateService(i, { duration_mins: Number(e.target.value) })}
                  placeholder="min"
                />
                <Button type="button" size="icon" variant="ghost" onClick={() => removeService(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 p-6">
          <div>
            <Label htmlFor="photos">Photos * (3–6)</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              First photo becomes the hero image — upload your strongest shot first.
            </p>
          </div>
          <Input id="photos" type="file" accept="image/*" multiple onChange={onPhotoSelect} />
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((f, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded border bg-muted">
                  <img src={URL.createObjectURL(f)} alt={`upload ${i + 1}`} className="h-full w-full object-cover" />
                  {i === 0 && (
                    <span className="absolute left-1 top-1 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-background">
                      Hero
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{photos.length}/6 selected</p>
        </Card>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…
            </>
          ) : (
            "Create preview page"
          )}
        </Button>
      </form>
    </div>
  );
};

export default AdminNewPreview;
