import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ProfileCompletionCardProps {
  staffId: string;
}

export const ProfileCompletionCard = ({ staffId }: ProfileCompletionCardProps) => {
  const { data: completionData, isLoading } = useQuery({
    queryKey: ["profile-completion", staffId],
    queryFn: async () => {
      const { data: staff, error } = await supabase
        .from("staff_members")
        .select("profile_image_url, bio")
        .eq("id", staffId)
        .single();

      if (error) throw error;

      const { count: portfolioCount } = await supabase
        .from("client_content")
        .select("*", { count: "exact", head: true })
        .eq("creative_id", staffId);

      return {
        hasProfilePicture: !!staff.profile_image_url,
        hasBio: !!staff.bio && staff.bio.length > 10,
        hasPortfolio: (portfolioCount || 0) > 0,
      };
    },
  });

  if (isLoading) return null;

  const tasks = [
    { label: "Upload profile picture", complete: completionData?.hasProfilePicture },
    { label: "Write your bio", complete: completionData?.hasBio },
    { label: "Upload your first cut", complete: completionData?.hasPortfolio },
  ];

  const completedCount = tasks.filter((t) => t.complete).length;
  const totalCount = tasks.length;
  const progress = (completedCount / totalCount) * 100;
  const isComplete = completedCount === totalCount;

  if (isComplete) {
    return (
      <Card className="border-green-500 bg-green-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <Sparkles className="h-5 w-5" />
            Profile Complete!
          </CardTitle>
          <CardDescription>
            Your profile is ready. Clients can now discover and book you!
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Complete Your Profile ({completedCount}/{totalCount})
        </CardTitle>
        <CardDescription>
          Finish setting up your profile to start getting bookings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progress} className="h-2" />
        <ul className="space-y-2">
          {tasks.map((task, index) => (
            <li key={index} className="flex items-center gap-2">
              {task.complete ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              )}
              <span className={task.complete ? "text-muted-foreground line-through" : ""}>
                {task.label}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};
