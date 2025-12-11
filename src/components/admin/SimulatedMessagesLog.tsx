import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare, RefreshCw, Phone, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export const SimulatedMessagesLog = () => {
  const { data: simulatedLogs, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['simulated-notification-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_logs')
        .select('*')
        .eq('status', 'simulated')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Simulated Messages Log
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Simulated Messages Log
            </CardTitle>
            <CardDescription>
              View messages sent to test users (not actually delivered)
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!simulatedLogs || simulatedLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No simulated messages yet.</p>
            <p className="text-sm mt-2">
              Mark a client or staff member as a "test user" to simulate messages without sending.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {simulatedLogs.map((log) => {
                // Extract the actual message content from error_message field
                const messageContent = log.error_message?.replace('SIMULATED MESSAGE CONTENT: ', '') || 'No content';
                
                return (
                  <div 
                    key={log.id} 
                    className="border rounded-lg p-4 bg-muted/30"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                          SIMULATED
                        </Badge>
                        <Badge variant="outline">{log.message_type}</Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {log.created_at ? format(new Date(log.created_at), 'MMM d, HH:mm:ss') : 'Unknown'}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono">{log.recipient_phone}</span>
                    </div>
                    
                    <div className="bg-background rounded p-3 border">
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {messageContent}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
