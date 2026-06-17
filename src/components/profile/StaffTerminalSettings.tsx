import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bluetooth,
  CheckCircle,
  CreditCard,
  Info,
  Loader2,
  Lock,
  MapPin,
  Search,
  ShieldCheck,
  Smartphone,
  SmartphoneNfc,
  WalletCards,
  Waves,
  Wifi,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePlatform } from '@/hooks/usePlatform';
import { useTerminalPayment } from '@/hooks/useTerminalPayment';
import { getTestModeHeaders } from '@/hooks/useTestModeOverride';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface StaffTerminalSettingsProps {
  staffId: string;
  returnToPath?: string;
}

type TerminalConnectionType = 'tap_to_pay' | 'bluetooth' | 'internet';
const onboardingCompletionKey = (staffId: string) => `tap_to_pay_onboarding_complete_${staffId}`;
const onboardingPromptSeenKey = (staffId: string) => `tap_to_pay_onboarding_prompt_seen_${staffId}`;

export const StaffTerminalSettings = ({ staffId, returnToPath = '/my-profile?tab=settings' }: StaffTerminalSettingsProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const {
    isNative,
    isIOS,
    canUseTapToPay,
    canUseBluetoothReader,
    isStripeTerminalPluginAvailable,
  } = usePlatform();
  const { discoverReaders, connectReader, discoveredReaders, connectedReader, isProcessing } = useTerminalPayment();
  const { isSuperAdmin } = useSuperAdmin();

  const [connectionType, setConnectionType] = useState<TerminalConnectionType>('tap_to_pay');
  const [readerId, setReaderId] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingSettings, setExistingSettings] = useState<any>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [allowedTerminalTypes, setAllowedTerminalTypes] = useState<string[]>([
    'tap_to_pay',
    'bluetooth',
    'business_reader',
  ]);
  const [isCreatingLocation, setIsCreatingLocation] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const settingsCardRef = useRef<HTMLDivElement | null>(null);

  const isTestModeActive = localStorage.getItem('FORCE_STRIPE_MODE') === 'test';
  const tapToPayLabel = isIOS ? 'Tap to Pay on iPhone' : 'Tap to Pay on Android';
  const tapToPayShortLabel = isIOS ? 'Tap to Pay on iPhone' : 'Tap to Pay';
  const platformBuildCommand = isIOS ? 'npm run build && npx cap sync ios' : 'npm run build && npx cap sync android';
  const openFullScreenOnboarding = () => {
    navigate(
      `/tap-to-pay-onboarding?staffId=${encodeURIComponent(staffId)}&returnTo=${encodeURIComponent(returnToPath)}`
    );
  };

  useEffect(() => {
    setHasCompletedOnboarding(localStorage.getItem(onboardingCompletionKey(staffId)) === 'true');
  }, [staffId]);

  useEffect(() => {
    loadSettings();
  }, [staffId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserEmail(data.user?.email ?? null);
    });
  }, []);


  const loadSettings = async () => {
    try {
      const [terminalResult, staffResult, businessResult] = await Promise.all([
        supabase
          .from('terminal_settings')
          .select('*')
          .eq('staff_id', staffId)
          .eq('is_active', true)
          .maybeSingle(),
        supabase
          .from('staff_members')
          .select('allowed_terminal_types, display_name, business_id')
          .eq('id', staffId)
          .single(),
        supabase
          .from('staff_members')
          .select('business_id, business_accounts!inner(business_type)')
          .eq('id', staffId)
          .single(),
      ]);

      if (terminalResult.error) throw terminalResult.error;

      if (terminalResult.data) {
        setExistingSettings(terminalResult.data);
        setConnectionType((terminalResult.data.connection_type as TerminalConnectionType) || 'tap_to_pay');
        setReaderId(terminalResult.data.reader_id || '');
      }

      let isSolo = false;
      const allMethods = ['tap_to_pay', 'bluetooth', 'business_reader'];

      if (businessResult.data) {
        isSolo = (businessResult.data as any)?.business_accounts?.business_type === 'solo_professional';
      }

      if (!isSolo && staffResult.data?.business_id) {
        const { data: bizData } = await supabase
          .from('business_accounts')
          .select('business_type')
          .eq('id', staffResult.data.business_id)
          .single();
        isSolo = bizData?.business_type === 'solo_professional';
      }

      if (isSolo) {
        setAllowedTerminalTypes(allMethods);
        if (
          !staffResult.data?.allowed_terminal_types ||
          !staffResult.data.allowed_terminal_types.includes('tap_to_pay')
        ) {
          await supabase
            .from('staff_members')
            .update({ allowed_terminal_types: allMethods })
            .eq('id', staffId);
        }
      } else if (staffResult.data?.allowed_terminal_types) {
        setAllowedTerminalTypes(staffResult.data.allowed_terminal_types);
      }
    } catch (error) {
      console.error('Error loading terminal settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTerminalLocation = async (forceTestMode = false): Promise<string | null> => {
    setIsCreatingLocation(true);
    try {
      const { data: staffData } = await supabase
        .from('staff_members')
        .select('display_name')
        .eq('id', staffId)
        .single();

      const baseHeaders = forceTestMode ? { 'x-force-test-mode': 'true' } : getTestModeHeaders();
      const headers =
        baseHeaders['x-force-test-mode'] === 'true' || baseHeaders['x-force-live-mode'] === 'true'
          ? baseHeaders
          : currentUserEmail && /(^test|test@|@test\.|@example\.|demo|qa)/i.test(currentUserEmail)
            ? { 'x-force-test-mode': 'true' }
            : baseHeaders;

      const { data, error } = await supabase.functions.invoke('create-terminal-location', {
        body: {
          staffId,
          displayName: `${staffData?.display_name || 'Staff'} - Tap to Pay (${headers['x-force-test-mode'] === 'true' ? 'TEST' : 'LIVE'})`,
        },
        headers,
      });

      if (error) throw error;

      toast({
        title: `${tapToPayShortLabel} configured`,
        description: `Payment location created in ${data.stripeMode || 'unknown'} mode.`,
      });

      return data.locationId;
    } catch (error: any) {
      toast({
        title: 'Setup failed',
        description: error.message || `Could not configure ${tapToPayShortLabel}`,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsCreatingLocation(false);
    }
  };

  const handleRecreateForTestMode = async () => {
    const newLocationId = await createTerminalLocation(true);
    if (newLocationId) {
      try {
        await supabase
          .from('terminal_settings')
          .upsert(
            {
              staff_id: staffId,
              connection_type: 'tap_to_pay',
              stripe_location_id: newLocationId,
              is_active: true,
            },
            { onConflict: 'staff_id' }
          );

        loadSettings();
      } catch (err) {
        console.error('[StaffTerminalSettings] Failed to update settings:', err);
      }
    }
  };




  const performSave = async () => {
    setSaving(true);
    try {
      let stripeLocationId = existingSettings?.stripe_location_id;

      if (connectionType === 'tap_to_pay' && !stripeLocationId) {
        stripeLocationId = await createTerminalLocation();
        if (!stripeLocationId) {
          setSaving(false);
          return;
        }
      }

      const getReaderInfo = () => {
        if (connectionType === 'bluetooth' && connectedReader) {
          return {
            reader_id: connectedReader.serialNumber,
            reader_name: connectedReader.label || 'Bluetooth Reader',
          };
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
        const { error } = await supabase.from('terminal_settings').insert(settingsData);
        if (error) throw error;
      }

      toast({
        title: 'Settings saved',
        description: `${
          connectionType === 'tap_to_pay'
            ? tapToPayShortLabel
            : connectionType === 'bluetooth'
              ? 'Bluetooth Reader'
              : 'WiFi Reader'
        } configured successfully`,
      });

      await loadSettings();
    } catch (error: any) {
      console.error('Error saving terminal settings:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (connectionType === 'tap_to_pay' && !hasCompletedOnboarding) {
      openFullScreenOnboarding();
      return;
    }

    await performSave();
  };

  const handleScanReaders = async () => {
    setIsDiscovering(true);
    try {
      await discoverReaders('bluetooth');
    } catch (error) {
      console.error('Error discovering readers:', error);
      toast({
        title: 'Scan failed',
        description: 'Could not find nearby readers. Make sure Bluetooth is enabled.',
        variant: 'destructive',
      });
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleConnectReader = async (reader: any) => {
    try {
      await connectReader(reader);
      toast({
        title: 'Reader connected',
        description: `Connected to ${reader.label || reader.serialNumber}`,
      });
    } catch (error) {
      console.error('Error connecting reader:', error);
      toast({
        title: 'Connection failed',
        description: 'Could not connect to the reader',
        variant: 'destructive',
      });
    }
  };

  const canUseTapToPayPermission = allowedTerminalTypes.includes('tap_to_pay');
  const canUseBluetoothPermission = allowedTerminalTypes.includes('bluetooth');
  const canUseBusinessReader = allowedTerminalTypes.includes('business_reader');
  const isRestrictedToBusinessReader = allowedTerminalTypes.length === 1 && canUseBusinessReader;

  const showTapToPayOnboardingCard = canUseTapToPay && canUseTapToPayPermission;
  const statusLabel = useMemo(() => {
    if (!existingSettings) return null;
    if (existingSettings.connection_type === 'tap_to_pay') return tapToPayShortLabel;
    if (existingSettings.connection_type === 'bluetooth') {
      return `Bluetooth (${existingSettings.reader_name || 'Reader'})`;
    }
    return 'WiFi Reader';
  }, [existingSettings, tapToPayShortLabel]);

  if (loading) {
    return (
      <Card ref={settingsCardRef}>
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

  if (!isNative) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Terminal & Hardware
          </CardTitle>
          <CardDescription>Configure your personal card reader</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 py-6 text-center">
            <Smartphone className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Terminal settings are configured in the native app.
            </p>
            <p className="text-xs text-muted-foreground">
              Download the app to use {tapToPayShortLabel} or connect a Bluetooth reader.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isNative && !isStripeTerminalPluginAvailable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Terminal & Hardware
          </CardTitle>
          <CardDescription>Configure your personal card reader</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-8 w-8 shrink-0 text-amber-600" />
              <div className="space-y-2">
                <p className="font-medium text-amber-800 dark:text-amber-200">App Update Required</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {tapToPayShortLabel} and Bluetooth readers require the latest app version with payment hardware support.
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Please reinstall from the app store or rebuild with:
                </p>
                <code className="block rounded bg-amber-100 p-2 text-xs dark:bg-amber-900/30">
                  {platformBuildCommand}
                </code>
                <p className="mt-2 text-xs text-muted-foreground">
                  You can still use the shared WiFi reader configured by your business owner.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isRestrictedToBusinessReader) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Terminal & Hardware
          </CardTitle>
          <CardDescription>Payment method configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 py-6 text-center">
            <div className="flex items-center justify-center gap-2">
              <Wifi className="h-10 w-10 text-green-500" />
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Business Reader Only</p>
            <p className="text-sm text-muted-foreground">
              You&apos;re configured to use the shared business card reader.
            </p>
            <p className="text-xs text-muted-foreground">
              Contact your salon owner if you need access to {tapToPayShortLabel} or Bluetooth readers.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Terminal & Hardware
          </CardTitle>
          <CardDescription>Choose how you accept card payments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {showTapToPayOnboardingCard && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-blue-900 dark:text-blue-100">{tapToPayShortLabel} setup</p>
                    <Badge variant={hasCompletedOnboarding ? 'secondary' : 'default'}>
                      {hasCompletedOnboarding ? 'Completed' : 'Needs review'}
                    </Badge>
                  </div>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Complete setup, review the Terms &amp; Conditions, and revisit merchant guidance whenever you need it.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-300 bg-white text-blue-900 hover:bg-blue-100 dark:border-blue-800 dark:bg-transparent dark:text-blue-100"
                    onClick={openFullScreenOnboarding}
                  >
                      {hasCompletedOnboarding ? 'Review Tap to Pay setup' : 'Start Tap to Pay setup'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {(isCreatingLocation || (saving && connectionType === 'tap_to_pay')) && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
              <div className="flex items-start gap-3">
                <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-emerald-600" />
                <div className="space-y-1">
                  <p className="font-medium text-emerald-900 dark:text-emerald-100">Configuring {tapToPayShortLabel}...</p>
                  <p className="text-sm text-emerald-800 dark:text-emerald-200">
                    We&apos;re creating or updating the merchant&apos;s payment location and saving the setup for this device.
                  </p>
                </div>
              </div>
            </div>
          )}

          <RadioGroup
            value={connectionType}
            onValueChange={(value) => setConnectionType(value as TerminalConnectionType)}
            className="space-y-3"
          >
            {canUseTapToPay && canUseTapToPayPermission && (
              <div className="flex items-start space-x-3 rounded-lg border p-4 transition-colors hover:bg-accent/50">
                <RadioGroupItem value="tap_to_pay" id="tap_to_pay" className="mt-1" />
                <Label htmlFor="tap_to_pay" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-primary" />
                    <span className="font-medium">{tapToPayLabel}</span>
                    <Badge variant="secondary" className="text-xs">
                      Recommended
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Accept contactless payments directly on this phone. No separate reader is needed.
                  </p>
                </Label>
              </div>
            )}

            {canUseBluetoothReader && canUseBluetoothPermission && (
              <div className="flex items-start space-x-3 rounded-lg border p-4 transition-colors hover:bg-accent/50">
                <RadioGroupItem value="bluetooth" id="bluetooth" className="mt-1" />
                <Label htmlFor="bluetooth" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Bluetooth className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Bluetooth Reader</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Connect a portable Stripe reader (BBPOS, Chipper, and similar supported devices).
                  </p>
                </Label>
              </div>
            )}

            {canUseBusinessReader && (
              <div className="flex items-start space-x-3 rounded-lg border p-4 transition-colors hover:bg-accent/50">
                <RadioGroupItem value="internet" id="internet" className="mt-1" />
                <Label htmlFor="internet" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-5 w-5 text-green-500" />
                    <span className="font-medium">WiFi Reader</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Use a shared WiFi-connected reader (WisePOS E, S700, and similar supported devices).
                  </p>
                </Label>
              </div>
            )}
          </RadioGroup>

          {connectionType === 'internet' && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <Label htmlFor="reader-id" className="text-sm font-medium">
                Reader ID
              </Label>
              <Input
                id="reader-id"
                value={readerId}
                onChange={(event) => setReaderId(event.target.value)}
                placeholder="tmr_xxxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">
                Find this in your Stripe Dashboard under Terminal → Readers.
              </p>
            </div>
          )}

          {connectionType === 'bluetooth' && (
            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Pair Bluetooth Reader</h4>
                <Button variant="outline" size="sm" onClick={handleScanReaders} disabled={isDiscovering}>
                  {isDiscovering ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
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
                      className="flex items-center justify-between rounded-md border bg-background p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{reader.label || 'Stripe Reader'}</p>
                        <p className="text-xs text-muted-foreground">{reader.serialNumber}</p>
                      </div>
                      {connectedReader?.serialNumber === reader.serialNumber ? (
                        <Badge className="bg-green-500">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Connected
                        </Badge>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => handleConnectReader(reader)} disabled={isProcessing}>
                          Connect
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {isDiscovering ? 'Looking for nearby readers...' : 'No readers found. Tap “Scan for Readers” to search.'}
                </p>
              )}
            </div>
          )}

          {existingSettings && statusLabel && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-muted-foreground">Currently using: {statusLabel}</span>
              </div>
              {existingSettings.stripe_location_id && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>Location: {existingSettings.stripe_location_id}</span>
                </div>
              )}
            </div>
          )}

          {isSuperAdmin && connectionType === 'tap_to_pay' && (
            <Button variant="outline" onClick={handleRecreateForTestMode} disabled={isCreatingLocation || saving}>
              Recreate Tap to Pay location in TEST mode
            </Button>
          )}

          <Button
            onClick={handleSave}
            disabled={
              saving ||
              isCreatingLocation ||
              (connectionType === 'bluetooth' && !connectedReader && !existingSettings?.reader_id) ||
              (connectionType === 'internet' && !readerId)
            }
            className="w-full"
          >
            {isCreatingLocation ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Configuring {tapToPayShortLabel}...
              </>
            ) : saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Terminal Settings'
            )}
          </Button>
        </CardContent>
      </Card>

    </>
  );
};
