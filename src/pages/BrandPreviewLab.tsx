import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Globe, Instagram, MessageCircle, Search, Sparkles, Star, Wand2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type BrandTone = "sharp" | "luxury" | "community" | "editorial";

const toneStyles: Record<BrandTone, { accent: string; background: string; border: string; copy: string }> = {
  sharp: {
    accent: "from-zinc-900 via-zinc-700 to-zinc-500",
    background: "bg-zinc-950 text-white",
    border: "border-zinc-700",
    copy: "Precision cuts, clean lines, instant booking.",
  },
  luxury: {
    accent: "from-stone-900 via-amber-700 to-amber-500",
    background: "bg-stone-950 text-stone-50",
    border: "border-amber-600/40",
    copy: "Premium grooming, elevated presence, polished client experience.",
  },
  community: {
    accent: "from-emerald-900 via-emerald-700 to-teal-500",
    background: "bg-emerald-950 text-emerald-50",
    border: "border-emerald-500/40",
    copy: "Friendly local brand, easy rebooking, loyal regulars.",
  },
  editorial: {
    accent: "from-sky-900 via-cyan-700 to-fuchsia-500",
    background: "bg-slate-950 text-slate-50",
    border: "border-sky-500/40",
    copy: "Visual-first profile with standout work and a modern booking funnel.",
  },
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const initialsFrom = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "BD";

export default function BrandPreviewLab() {
  const [handle, setHandle] = useState("fadebyjamie");
  const [displayName, setDisplayName] = useState("Jamie Byrne");
  const [city, setCity] = useState("Dublin 8");
  const [followers, setFollowers] = useState("12800");
  const [bio, setBio] = useState("Skin fades, textured crops, beard shaping. Clean cuts, easy chat, no wasted time.");
  const [specialties, setSpecialties] = useState("Skin fades, textured crop, beard shaping");
  const [tone, setTone] = useState<BrandTone>("sharp");

  const preview = useMemo(() => {
    const toneStyle = toneStyles[tone];
    const firstName = displayName.split(" ")[0] || displayName;
    const specialtyList = specialties
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 4);
    const slug = slugify(displayName || handle || "bookd-preview");
    const followerNumber = Number(followers.replace(/[^0-9]/g, "")) || 0;
    const formattedFollowers = followerNumber >= 1000 ? `${(followerNumber / 1000).toFixed(1)}k` : `${followerNumber}`;
    const seoTitle = `${displayName} | Barber in ${city} | Book online with Bookd`;
    const seoDescription = `${displayName} is a ${city} barber specialising in ${specialtyList.slice(0, 2).join(" and ")}. View availability, book instantly, and share your fresh cut.`;
    const outreach = `Built this mock booking page for ${displayName} after seeing @${handle}. It makes the profile feel more premium, easier to book, and stronger for shares. If you want, I can send over the live preview link.`;

    return {
      firstName,
      specialtyList,
      slug,
      formattedFollowers,
      seoTitle,
      seoDescription,
      outreach,
      toneStyle,
      bookingUrl: `bookd.app/${slug}`,
      socialProof: `${formattedFollowers} followers`,
    };
  }, [bio, city, displayName, followers, handle, specialties, tone]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.08),_transparent_40%),linear-gradient(180deg,_#0d1117,_#161b22)] text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Link>
            <div className="flex items-center gap-2">
              <Badge className="bg-white/10 text-white hover:bg-white/10">Standalone concept</Badge>
              <Badge variant="outline" className="border-white/20 text-zinc-200">Outbound growth</Badge>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Instant Barber Brand Preview</h1>
            <p className="max-w-3xl text-base text-zinc-300">
              This is a first-pass marketing tool for turning an Instagram identity into a premium Bookd booking page,
              a shareable preview link, and a personalised outreach angle.
            </p>
          </div>
          <Button asChild variant="outline" className="hidden border-white/20 bg-white/5 text-white hover:bg-white/10 lg:inline-flex">
            <a href="#preview">Jump to preview</a>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-cyan-300" />
                Prospect Inputs
              </CardTitle>
              <CardDescription className="text-zinc-300">
                For now this is a guided mock import. Later this can be fed by screenshots, handles, or approved enrichment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="handle">Instagram handle</Label>
                <Input
                  id="handle"
                  value={handle}
                  onChange={(event) => setHandle(event.target.value.replace(/^@/, ""))}
                  className="border-white/10 bg-black/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="border-white/10 bg-black/20 text-white"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">City / area</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    className="border-white/10 bg-black/20 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="followers">Follower count</Label>
                  <Input
                    id="followers"
                    value={followers}
                    onChange={(event) => setFollowers(event.target.value)}
                    className="border-white/10 bg-black/20 text-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialties">Specialties</Label>
                <Input
                  id="specialties"
                  value={specialties}
                  onChange={(event) => setSpecialties(event.target.value)}
                  className="border-white/10 bg-black/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Current bio / vibe</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  className="min-h-[110px] border-white/10 bg-black/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label>Brand direction</Label>
                <Select value={tone} onValueChange={(value) => setTone(value as BrandTone)}>
                  <SelectTrigger className="border-white/10 bg-black/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sharp">Sharp / modern barber</SelectItem>
                    <SelectItem value="luxury">Premium / elevated</SelectItem>
                    <SelectItem value="community">Neighbourhood / warm</SelectItem>
                    <SelectItem value="editorial">Content-led / creator</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator className="bg-white/10" />

              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <Sparkles className="h-4 w-4" />
                  Why this is useful in sales
                </div>
                <p>
                  Instead of saying “switch booking systems”, you can show a barber how Bookd makes them look more
                  premium, more bookable, and more shareable without forcing them to imagine it.
                </p>
              </div>
            </CardContent>
          </Card>

          <div id="preview" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <Card className={`overflow-hidden border ${preview.toneStyle.border} bg-white text-zinc-900`}>
                <div className={`h-32 bg-gradient-to-r ${preview.toneStyle.accent}`} />
                <CardContent className="space-y-6 p-6">
                  <div className="-mt-16 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex items-end gap-4">
                      <Avatar className="h-24 w-24 border-4 border-white bg-black">
                        <AvatarFallback className="bg-black text-2xl font-bold text-white">
                          {initialsFrom(displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-zinc-500">@{handle}</p>
                        <h2 className="text-3xl font-bold">{displayName}</h2>
                        <div className="flex flex-wrap gap-2 text-sm text-zinc-600">
                          <span>{city}</span>
                          <span>•</span>
                          <span>{preview.socialProof}</span>
                          <span>•</span>
                          <span>4.9 rating</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button className="bg-zinc-950 text-white hover:bg-zinc-800">Book now</Button>
                      <Button variant="outline">Share profile</Button>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="space-y-4">
                      <div>
                        <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Bookd hero</h3>
                        <div className={`rounded-3xl p-6 ${preview.toneStyle.background}`}>
                          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em]">
                            <Instagram className="h-3.5 w-3.5" />
                            Built from social identity
                          </div>
                          <h4 className="max-w-lg text-3xl font-bold leading-tight">
                            {preview.firstName} now has a booking page that looks as good as the cuts.
                          </h4>
                          <p className="mt-3 max-w-xl text-sm text-white/80">{preview.toneStyle.copy}</p>
                          <div className="mt-5 flex flex-wrap gap-2">
                            {preview.specialtyList.map((specialty) => (
                              <Badge key={specialty} className="bg-white/10 text-white hover:bg-white/10">
                                {specialty}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Card className="border-zinc-200">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Search className="h-4 w-4 text-cyan-600" />
                              SEO landing page
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <p className="font-medium text-blue-700">{preview.bookingUrl}</p>
                            <p className="font-semibold">{preview.seoTitle}</p>
                            <p className="text-zinc-600">{preview.seoDescription}</p>
                          </CardContent>
                        </Card>

                        <Card className="border-zinc-200">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Globe className="h-4 w-4 text-cyan-600" />
                              Bio link upgrade
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            <div className="rounded-xl bg-zinc-100 p-3">Book cut</div>
                            <div className="rounded-xl bg-zinc-100 p-3">WhatsApp concierge</div>
                            <div className="rounded-xl bg-zinc-100 p-3">Fresh cuts gallery</div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="mx-auto w-full max-w-[290px] rounded-[32px] border border-white/10 bg-black p-3 shadow-2xl">
                        <div className="overflow-hidden rounded-[26px] bg-white">
                          <div className={`bg-gradient-to-r px-5 py-6 ${preview.toneStyle.accent}`}>
                            <div className="text-xs uppercase tracking-[0.2em] text-white/80">Phone preview</div>
                            <div className="mt-2 text-2xl font-bold text-white">Book with {preview.firstName}</div>
                          </div>
                          <div className="space-y-4 p-5">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-14 w-14 bg-zinc-900">
                                <AvatarFallback className="bg-zinc-900 text-white">
                                  {initialsFrom(displayName)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-semibold">{displayName}</div>
                                <div className="text-sm text-zinc-500">@{handle}</div>
                              </div>
                            </div>
                            <p className="text-sm text-zinc-600">{bio}</p>
                            <div className="grid grid-cols-2 gap-2 text-center">
                              <div className="rounded-2xl bg-zinc-100 px-3 py-3">
                                <div className="text-lg font-bold">{preview.formattedFollowers}</div>
                                <div className="text-xs text-zinc-500">Followers</div>
                              </div>
                              <div className="rounded-2xl bg-zinc-100 px-3 py-3">
                                <div className="flex items-center justify-center gap-1 text-lg font-bold">
                                  4.9 <Star className="h-4 w-4 fill-current text-amber-400" />
                                </div>
                                <div className="text-xs text-zinc-500">Client rating</div>
                              </div>
                            </div>
                            <Button className="w-full bg-zinc-950 text-white hover:bg-zinc-800">See live availability</Button>
                          </div>
                        </div>
                      </div>

                      <Card className="border-white/10 bg-white/5 text-white">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Sales angle</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-zinc-300">
                          <p>Don’t pitch “replace your current system.” Pitch:</p>
                          <p className="rounded-xl bg-white/5 p-3 text-white">
                            “This is what your brand could look like with a proper booking front door.”
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="border-white/10 bg-white/5 text-white">
                  <CardHeader>
                    <CardTitle className="text-base">Outreach message</CardTitle>
                    <CardDescription className="text-zinc-300">
                      A human-sounding first message built from the preview.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="rounded-2xl bg-black/20 p-4 text-zinc-100">{preview.outreach}</div>
                    <Button className="w-full bg-white text-zinc-950 hover:bg-zinc-200">
                      Copy message
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/5 text-white">
                  <CardHeader>
                    <CardTitle className="text-base">Current vs upgraded</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-zinc-300">
                    <div className="rounded-2xl border border-white/10 p-4">
                      <div className="mb-2 flex items-center gap-2 font-medium text-white">
                        <Instagram className="h-4 w-4" />
                        Current
                      </div>
                      <p>Good social proof, but booking intent leaks away through DMs, bio friction, and no polished client funnel.</p>
                    </div>
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                      <div className="mb-2 flex items-center gap-2 font-medium text-white">
                        <ExternalLink className="h-4 w-4" />
                        Bookd upgrade
                      </div>
                      <p>Stronger visual identity, instant booking link, local-search footprint, shareable brand page, and a cleaner “send this to clients” experience.</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/5 text-white">
                  <CardHeader>
                    <CardTitle className="text-base">Future data sources</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-zinc-300">
                    <p>Safe MVP inputs:</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-white/20 text-zinc-200">manual handle</Badge>
                      <Badge variant="outline" className="border-white/20 text-zinc-200">profile screenshots</Badge>
                      <Badge variant="outline" className="border-white/20 text-zinc-200">uploaded photos</Badge>
                      <Badge variant="outline" className="border-white/20 text-zinc-200">barber-submitted details</Badge>
                    </div>
                    <Separator className="bg-white/10" />
                    <p className="flex items-start gap-2">
                      <MessageCircle className="mt-0.5 h-4 w-4 text-cyan-300" />
                      Outreach should stay high-touch and personalised. The preview is the asset; the DM should still feel human.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
