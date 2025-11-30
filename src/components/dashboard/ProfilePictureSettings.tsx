import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProfilePictureSettingsProps {
  staffId: string;
}

export const ProfilePictureSettings = ({ staffId }: ProfilePictureSettingsProps) => {
  const [currentImage, setCurrentImage] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrentImage();
  }, [staffId]);

  const loadCurrentImage = async () => {
    try {
      const { data, error } = await supabase
        .from("staff_members")
        .select("profile_image_url")
        .eq("id", staffId)
        .single();

      if (error) throw error;
      if (data?.profile_image_url) {
        setCurrentImage(data.profile_image_url);
      }
    } catch (error) {
      console.error("Error loading profile image:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = async (url: string) => {
    try {
      const { error } = await supabase
        .from("staff_members")
        .update({ profile_image_url: url })
        .eq("id", staffId);

      if (error) throw error;

      setCurrentImage(url);
      toast.success("Profile picture updated successfully");
    } catch (error: any) {
      console.error("Error updating profile picture:", error);
      toast.error("Failed to update profile picture");
    }
  };

  if (loading) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Picture</CardTitle>
        <CardDescription>
          Upload your profile picture to personalize your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ImageUpload
          bucket="profile-images"
          folder={staffId}
          aspectRatio="1:1"
          onUploadComplete={handleUploadComplete}
          currentImageUrl={currentImage}
          maxSizeMB={5}
        />
      </CardContent>
    </Card>
  );
};
