import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function ImageProcessingTest() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show original
    const reader = new FileReader();
    reader.onload = (e) => setOriginalImage(e.target?.result as string);
    reader.readAsDataURL(file);

    setProcessing(true);
    setEnhancedImage(null);
    setStats(null);

    try {
      console.log('[Test] Uploading to storage...');
      const fileName = `test-${Date.now()}.jpg`;
      const filePath = `test/${fileName}`;

      // Upload to raw bucket
      const { error: uploadError } = await supabase.storage
        .from('client-content-raw')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      console.log('[Test] Creating content record...');
      // Create a client_content record
      const { data: contentData, error: insertError } = await supabase
        .from('client_content')
        .insert({
          creative_id: '00000000-0000-0000-0000-000000000000', // Test ID
          raw_file_path: filePath,
          media_type: 'image',
          visibility_scope: 'private',
          client_approved: false,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log('[Test] Calling process-media function...');
      const startTime = Date.now();
      
      // Call process-media function
      const { data: processData, error: processError } = await supabase.functions.invoke('process-media', {
        body: {
          contentId: contentData.id,
          rawFilePath: filePath,
          mediaType: 'image',
          creativeId: '00000000-0000-0000-0000-000000000000'
        }
      });

      const processingTime = Date.now() - startTime;

      if (processError) throw processError;

      console.log('[Test] Processing complete!', processData);
      
      setEnhancedImage(processData.enhancedUrl);
      
      // Fetch file sizes
      const { data: rawFile } = await supabase.storage
        .from('client-content-raw')
        .download(filePath);
      
      const { data: enhancedFile } = await supabase.storage
        .from('client-content-enhanced')
        .download(contentData.enhanced_file_path || '');

      setStats({
        originalSize: rawFile ? (rawFile.size / 1024).toFixed(2) : '?',
        enhancedSize: enhancedFile ? (enhancedFile.size / 1024).toFixed(2) : '?',
        processingTime: (processingTime / 1000).toFixed(2),
        metadata: contentData.ai_metadata
      });

      toast.success('Processing complete!');
    } catch (error: any) {
      console.error('[Test] Error:', error);
      toast.error(error.message || 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Image Processing Test</h1>
          <p className="text-muted-foreground">
            Upload an image to test the DIY enhancement pipeline
          </p>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileUpload}
                disabled={processing}
                className="flex-1"
              />
              {processing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </div>
              )}
            </div>

            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg text-sm">
                <div>
                  <div className="text-muted-foreground">Original Size</div>
                  <div className="font-mono font-bold">{stats.originalSize} KB</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Enhanced Size</div>
                  <div className="font-mono font-bold">{stats.enhancedSize} KB</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Processing Time</div>
                  <div className="font-mono font-bold">{stats.processingTime}s</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Enhancements</div>
                  <div className="text-xs">
                    {stats.metadata?.enhancements?.lightness}, {stats.metadata?.enhancements?.saturation}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Original</h3>
              {originalImage ? (
                <img src={originalImage} alt="Original" className="w-full rounded-lg" />
              ) : (
                <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Upload className="h-12 w-12 mx-auto mb-2" />
                    <p>Upload an image to begin</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Enhanced (DIY Processing)</h3>
              {enhancedImage ? (
                <img src={enhancedImage} alt="Enhanced" className="w-full rounded-lg" />
              ) : (
                <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    {processing ? (
                      <>
                        <Loader2 className="h-12 w-12 mx-auto mb-2 animate-spin" />
                        <p>Processing image...</p>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-12 w-12 text-brand mx-auto mb-2" />
                        <p>Enhanced version will appear here</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
