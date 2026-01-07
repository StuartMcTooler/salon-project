import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Bluetooth, Loader2, CheckCircle, Search, CreditCard, Wifi, Lock, MapPin, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePlatform } from '@/hooks/usePlatform';
import { useTerminalPayment } from '@/hooks/useTerminalPayment';

interface StaffTerminalSettingsProps {
  staffId: string;
}

export const StaffTerminalSettings = ({ staffId }: StaffTerminalSettingsProps) => {
  const { toast } = useToast();
  const { isNative, canUseTapToPay, canUseBluetoothReader, isStripeTerminalPluginAvailable } = usePlatform();
  const { discoverReaders, connectReader, discoveredReaders, connectedReader, isProcessing } = useTerminalPayment();
  
  const [connectionType, setConnectionType] = useState<'tap_to_pay' | 'bluetooth' | 'internet'>('tap_to_pay');
  const [readerId, setReaderId] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingSettings, setExistingSettings] = useState<any>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [allowedTerminalTypes, setAllowedTerminalTypes] = useState<string[]>(['business_reader']);
  const [isCreatingLocation, setIsCreatingLocation] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [staffId]);

  const loadSettings = async () => {
    try {
      // Load both terminal settings and staff permissions
      const [terminalResult, staffResult] = await Promise.all([
        supabase
          .from('terminal_settings')
          .select('*')
          .eq('staff_id', staffId)
          .eq('is_active', true)
          .maybeSingle(),
        supabase
          .from('staff_members')
          .select('allowed_terminal_types, display_name')
          .eq('id', staffId)
          .single()
      ]);

      if (terminalResult.error) throw terminalResult.error;

      if (terminalResult.data) {
        setExistingSettings(terminalResult.data);
        setConnectionType(terminalResult.data.connection_type as 'tap_to_pay' | 'bluetooth' | 'internet' || 'tap_to_pay');
        setReaderId(terminalResult.data.reader_id || '');
      }

      // Set allowed terminal types (default to business_reader if not set)
      if (staffResult.data?.allowed_terminal_types) {
        setAllowedTerminalTypes(staffResult.data.allowed_terminal_types);
      }
    } catch (error) {
      console.error('Error loading terminal settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create Stripe Terminal Location for Tap to Pay
  const createTerminalLocation = async (): Promise<string | null> => {
    setIsCreatingLocation(true);
    try {
      // Get staff display name for location
      const { data: staffData } = await supabase
        .from('staff_members')
        .select('display_name')
        .eq('id', staffId)
        .single();

      console.log('[StaffTerminalSettings] Creating Stripe Terminal Location...');
      
      const { data, error } = await supabase.functions.invoke('create-terminal-location', {
        body: {
          staffId,
          displayName: `${staffData?.display_name || 'Staff'} - Tap to Pay`,
        },
      });

      if (error) {
        console.error('[StaffTerminalSettings] Location creation failed:', error);
        throw error;
      }

      console.log('[StaffTerminalSettings] ✅ Location created:', data.locationId);
      
      toast({
        title: "Tap to Pay configured",
        description: "Your payment location has been set up successfully.",
      });

      return data.locationId;
    } catch (error: any) {
      console.error('[StaffTerminalSettings] Error creating location:', error);
      toast({
        title: "Setup failed",
        description: error.message || "Could not configure Tap to Pay location",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsCreatingLocation(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // If selecting Tap to Pay and no location exists, create one first
      let stripeLocationId = existingSettings?.stripe_location_id;
      
      if (connectionType === 'tap_to_pay' && !stripeLocationId) {
        console.log('[StaffTerminalSettings] No location ID, creating one...');
        stripeLocationId = await createTerminalLocation();
        if (!stripeLocationId) {
          // Location creation failed, don't proceed
          setSaving(false);
          return;
        }
      }

      const getReaderInfo = () => {
        if (connectionType === 'bluetooth' && connectedReader) {
          return { reader_id: connectedReader.serialNumber, reader_name: connectedReader.label || 'Bluetooth Reader' };
        }
        if (connectionType === 'internet' && readerId) {
          return { reader_id: readerId, reader_name: 'WiFi Reader' };
        }
        return { reader_id: null, reader_name: null };
      };

      const readerInfo = getReaderInfo();
      const settingsData: any = {
        staff_id: staffId,
        connection_type: connectionType,
        reader_id: readerInfo.reader_id,
        reader_name: readerInfo.reader_name,
        is_active: true,
      };

      // Include stripe_location_id if we have one (for Tap to Pay)
      if (stripeLocationId) {
        settingsData.stripe_location_id = stripeLocationId;
      }

      if (existingSettings) {
        const { error } = await supabase
          .from('terminal_settings')
          .update(settingsData)
          .eq('id', existingSettings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('terminal_settings')
          .insert(settingsData);
        if (error) throw error;
      }

      toast({
        title: "Settings saved",
        description: `${connectionType === 'tap_to_pay' ? 'Tap to Pay' : connectionType === 'bluetooth' ? 'Bluetooth Reader' : 'WiFi Reader'} configured successfully`,
      });

      loadSettings();
    } catch (error: any) {
      console.error('Error saving terminal settings:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleScanReaders = async () => {
    setIsDiscovering(true);
    try {
      await discoverReaders('bluetooth');
    } catch (error) {
      console.error('Error discovering readers:', error);
      toast({
        title: "Scan failed",
        description: "Could not find nearby readers. Make sure Bluetooth is enabled.",
        variant: "destructive",
      });
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleConnectReader = async (reader: any) => {
    try {
      await connectReader(reader);
      toast({
        title: "Reader connected",
        description: `Connected to ${reader.label || reader.serialNumber}`,
      });
    } catch (error) {
      console.error('Error connecting reader:', error);
      toast({
        title: "Connection failed",
        description: "Could not connect to the reader",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Terminal & Hardware
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check permissions
  const canUseTapToPayPermission = allowedTerminalTypes.includes('tap_to_pay');
  const canUseBluetoothPermission = allowedTerminalTypes.includes('bluetooth');
  const canUseBusinessReader = allowedTerminalTypes.includes('business_reader');
  const isRestrictedToBusinessReader = allowedTerminalTypes.length === 1 && canUseBusinessReader;

  // Web users see a different message
  if (!isNative) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Terminal & Hardware
          </CardTitle>
          <CardDescription>
            Configure your personal card reader
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 space-y-3">
            <Smartphone className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Terminal settings are configured in the native app.
            </p>
            <p className="text-xs text-muted-foreground">
              Download the app to use Tap to Pay or connect a Bluetooth reader.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Native app but plugin not available (stale APK / hot reload)
  if (isNative && !isStripeTerminalPluginAvailable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Terminal & Hardware
          </CardTitle>
          <CardDescription>
            Configure your personal card reader
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 border border-amber-300 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-600 shrink-0" />
              <div className="space-y-2">
                <p className="font-medium text-amber-800 dark:text-amber-200">App Update Required</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Tap to Pay and Bluetooth readers require the latest app version with payment hardware support.
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Please reinstall from the Play Store or rebuild with:
                </p>
                <code className="block text-xs bg-amber-100 dark:bg-amber-900/30 p-2 rounded">
                  npm run build && npx cap sync android
                </code>
                <p className="text-xs text-muted-foreground mt-2">
                  You can still use the shared WiFi reader configured by your business owner.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If staff is restricted to business reader only, show a different UI
  if (isRestrictedToBusinessReader) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Terminal & Hardware
          </CardTitle>
          <CardDescription>
            Payment method configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 space-y-3">
            <div className="flex items-center justify-center gap-2">
              <Wifi className="h-10 w-10 text-green-500" />
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Business Reader Only</p>
            <p className="text-sm text-muted-foreground">
              You're configured to use the shared business card reader.
            </p>
            <p className="text-xs text-muted-foreground">
              Contact your salon owner if you need access to Tap to Pay or Bluetooth readers.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Terminal & Hardware
        </CardTitle>
        <CardDescription>
          Choose how you accept card payments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup 
          value={connectionType} 
          onValueChange={(v) => setConnectionType(v as 'tap_to_pay' | 'bluetooth' | 'internet')}
          className="space-y-3"
        >
          {/* Tap to Pay Option - Only show if platform supports AND staff has permission */}
          {canUseTapToPay && canUseTapToPayPermission && (
            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
              <RadioGroupItem value="tap_to_pay" id="tap_to_pay" className="mt-1" />
              <Label htmlFor="tap_to_pay" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  <span className="font-medium">Tap to Pay on Android</span>
                  <Badge variant="secondary" className="text-xs">Recommended</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Accept contactless payments directly on your phone. No hardware needed.
                </p>
              </Label>
            </div>
          )}

          {/* Bluetooth Reader Option - Only show if platform supports AND staff has permission */}
          {canUseBluetoothReader && canUseBluetoothPermission && (
            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
              <RadioGroupItem value="bluetooth" id="bluetooth" className="mt-1" />
              <Label htmlFor="bluetooth" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Bluetooth className="h-5 w-5 text-blue-500" />
                  <span className="font-medium">Bluetooth Reader</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Connect a portable Stripe reader (BBPOS, Chipper, etc.)
                </p>
              </Label>
            </div>
          )}

          {/* WiFi/Internet Reader Option - Only show if staff has permission */}
          {canUseBusinessReader && (
            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
              <RadioGroupItem value="internet" id="internet" className="mt-1" />
              <Label htmlFor="internet" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Wifi className="h-5 w-5 text-green-500" />
                  <span className="font-medium">WiFi Reader</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Use a shared WiFi-connected reader (WisePOS E, S700, etc.)
                </p>
              </Label>
            </div>
          )}
        </RadioGroup>

        {/* WiFi Reader ID Input */}
        {connectionType === 'internet' && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <Label htmlFor="reader-id" className="text-sm font-medium">Reader ID</Label>
            <Input
              id="reader-id"
              value={readerId}
              onChange={(e) => setReaderId(e.target.value)}
              placeholder="tmr_xxxxxxxxxxxxx"
            />
            <p className="text-xs text-muted-foreground">
              Find this in your Stripe Dashboard under Terminal → Readers
            </p>
          </div>
        )}

        {/* Bluetooth Reader Discovery */}
        {connectionType === 'bluetooth' && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Pair Bluetooth Reader</h4>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleScanReaders}
                disabled={isDiscovering}
              >
                {isDiscovering ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Scan for Readers
                  </>
                )}
              </Button>
            </div>

            {discoveredReaders.length > 0 ? (
              <div className="space-y-2">
                {discoveredReaders.map((reader) => (
                  <div 
                    key={reader.id || reader.serialNumber}
                    className="flex items-center justify-between p-3 bg-background rounded-md border"
                  >
                    <div>
                      <p className="font-medium text-sm">{reader.label || 'Stripe Reader'}</p>
                      <p className="text-xs text-muted-foreground">{reader.serialNumber}</p>
                    </div>
                    {connectedReader?.serialNumber === reader.serialNumber ? (
                      <Badge className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => handleConnectReader(reader)}
                        disabled={isProcessing}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {isDiscovering ? 'Looking for nearby readers...' : 'No readers found. Tap "Scan for Readers" to search.'}
              </p>
            )}
          </div>
        )}

        {/* Current Status */}
        {existingSettings && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">
                Currently using: {existingSettings.connection_type === 'tap_to_pay' ? 'Tap to Pay' : existingSettings.connection_type === 'bluetooth' ? `Bluetooth (${existingSettings.reader_name || 'Reader'})` : 'WiFi Reader'}
              </span>
            </div>
            {existingSettings.stripe_location_id && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>Location: {existingSettings.stripe_location_id}</span>
              </div>
            )}
          </div>
        )}

        {/* Save Button */}
        <Button 
          onClick={handleSave} 
          disabled={saving || isCreatingLocation || (connectionType === 'bluetooth' && !connectedReader && !existingSettings?.reader_id) || (connectionType === 'internet' && !readerId)}
          className="w-full"
        >
          {isCreatingLocation ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Setting up Tap to Pay...
            </>
          ) : saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Terminal Settings'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
