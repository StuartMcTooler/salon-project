import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Smartphone, Bluetooth, Wifi, Loader2, CheckCircle } from 'lucide-react';
import { useTerminalPayment } from '@/hooks/useTerminalPayment';
import { usePlatform } from '@/hooks/usePlatform';

interface ReaderDiscoveryModalProps {
  open: boolean;
  onClose: () => void;
  onReaderConnected: (connectionType: string, reader?: any) => void;
}

export const ReaderDiscoveryModal = ({ open, onClose, onReaderConnected }: ReaderDiscoveryModalProps) => {
  const { isNative, canUseTapToPay, canUseBluetoothReader } = usePlatform();
  const { discoverReaders, connectReader, discoveredReaders, connectedReader, isProcessing, error } = useTerminalPayment();
  
  const [selectedMethod, setSelectedMethod] = useState<'tap_to_pay' | 'bluetooth' | 'internet' | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);

  const handleMethodSelect = async (method: 'tap_to_pay' | 'bluetooth' | 'internet') => {
    setSelectedMethod(method);
    
    if (method === 'internet') {
      // Internet readers don't need discovery - handled by settings
      onReaderConnected('internet');
      onClose();
      return;
    }
    
    setIsDiscovering(true);
    await discoverReaders(method);
    setIsDiscovering(false);
  };

  const handleReaderSelect = async (reader: any) => {
    await connectReader(reader);
    onReaderConnected(selectedMethod!, reader);
    onClose();
  };

  // For Tap to Pay, auto-connect when discovered
  useEffect(() => {
    if (selectedMethod === 'tap_to_pay' && discoveredReaders.length > 0 && !connectedReader) {
      handleReaderSelect(discoveredReaders[0]);
    }
  }, [selectedMethod, discoveredReaders, connectedReader]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Payment Reader</DialogTitle>
          <DialogDescription>
            Choose how you want to accept card payments
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {/* Tap to Pay option - Native only */}
          {canUseTapToPay && (
            <Button
              variant="outline"
              className="w-full h-auto p-4 flex items-start gap-4 justify-start"
              onClick={() => handleMethodSelect('tap_to_pay')}
              disabled={isDiscovering}
            >
              <Smartphone className="h-8 w-8 text-primary shrink-0" />
              <div className="text-left">
                <div className="font-semibold">Tap to Pay on Phone</div>
                <div className="text-sm text-muted-foreground">
                  Use your phone's NFC to accept contactless payments
                </div>
                <div className="text-xs text-green-600 mt-1">
                  ✓ No hardware needed
                </div>
              </div>
              {selectedMethod === 'tap_to_pay' && isDiscovering && (
                <Loader2 className="h-5 w-5 animate-spin ml-auto" />
              )}
            </Button>
          )}

          {/* Bluetooth option - Native only */}
          {canUseBluetoothReader && (
            <Button
              variant="outline"
              className="w-full h-auto p-4 flex items-start gap-4 justify-start"
              onClick={() => handleMethodSelect('bluetooth')}
              disabled={isDiscovering}
            >
              <Bluetooth className="h-8 w-8 text-blue-500 shrink-0" />
              <div className="text-left">
                <div className="font-semibold">Bluetooth Reader</div>
                <div className="text-sm text-muted-foreground">
                  Connect to a portable Stripe reader via Bluetooth
                </div>
              </div>
            </Button>
          )}

          {/* WiFi/Internet option - Always available */}
          <Button
            variant="outline"
            className="w-full h-auto p-4 flex items-start gap-4 justify-start"
            onClick={() => handleMethodSelect('internet')}
          >
            <Wifi className="h-8 w-8 text-purple-500 shrink-0" />
            <div className="text-left">
              <div className="font-semibold">Shared WiFi Reader</div>
              <div className="text-sm text-muted-foreground">
                Use a countertop reader connected to WiFi (WisePOS E, S700)
              </div>
            </div>
          </Button>

          {/* Bluetooth reader list */}
          {selectedMethod === 'bluetooth' && discoveredReaders.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium">Found Readers:</h4>
              {discoveredReaders.map((reader) => (
                <Button
                  key={reader.id || reader.serialNumber}
                  variant="secondary"
                  className="w-full justify-between"
                  onClick={() => handleReaderSelect(reader)}
                >
                  <span>{reader.label || reader.serialNumber || 'Stripe Reader'}</span>
                  {connectedReader?.id === reader.id && <CheckCircle className="h-4 w-4 text-green-500" />}
                </Button>
              ))}
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive mt-2">{error}</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
