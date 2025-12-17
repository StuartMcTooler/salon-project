import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Type definitions
type ConnectionType = 'internet' | 'bluetooth' | 'tap_to_pay';

interface TerminalConfig {
  connectionType: ConnectionType;
  readerId?: string;
  readerName?: string;
  locationId?: string;
}

interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  error?: string;
}

/**
 * Web version of useTerminalPayment - only supports server-driven payments
 * Native SDK features are not available in web builds
 */
export const useTerminalPayment = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialized] = useState(false);
  const [connectedReader] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [discoveredReaders] = useState<any[]>([]);

  // Initialize native SDK - no-op on web
  const initializeNativeSDK = useCallback(async () => {
    console.log('[TerminalPayment:Web] Native SDK not available in web build');
  }, []);

  // Discover readers - not available on web
  const discoverReaders = useCallback(async (_connectionType: ConnectionType, _locationId?: string) => {
    console.log('[TerminalPayment:Web] Reader discovery not available in web build');
    return [];
  }, []);

  // Connect to reader - not available on web
  const connectReader = useCallback(async (_reader: any) => {
    console.log('[TerminalPayment:Web] Reader connection not available in web build');
  }, []);

  // Server-driven payment flow (WiFi readers) - the only option on web
  const processServerDrivenPayment = async (
    amount: number,
    readerId: string,
    appointmentId?: string,
    customerEmail?: string
  ): Promise<PaymentResult> => {
    const { data, error } = await supabase.functions.invoke('create-terminal-payment', {
      body: { amount, readerId, appointmentId, customerEmail }
    });
    
    if (error) throw new Error(error.message);
    
    toast.success('Payment initiated on terminal');
    return {
      success: true,
      paymentIntentId: data.paymentIntentId,
    };
  };

  // Process payment - web only supports server-driven
  const processPayment = useCallback(async (
    amount: number,
    config: TerminalConfig,
    appointmentId?: string,
    customerEmail?: string
  ): Promise<PaymentResult> => {
    setIsProcessing(true);
    setError(null);

    try {
      if (config.connectionType === 'tap_to_pay' || config.connectionType === 'bluetooth') {
        // Native-only features not available on web
        throw new Error('Tap to Pay and Bluetooth readers are only available in the native app. Please use a WiFi reader or download the mobile app.');
      }
      
      // Server-driven payment for internet/WiFi readers
      console.log('[TerminalPayment:Web] Using server-driven payment');
      return await processServerDrivenPayment(amount, config.readerId!, appointmentId, customerEmail);
    } catch (err: any) {
      console.error('[TerminalPayment:Web] Payment error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return {
    // State
    isProcessing,
    isInitialized,
    connectedReader,
    discoveredReaders,
    error,
    
    // Actions
    initializeNativeSDK,
    discoverReaders,
    connectReader,
    processPayment,
    
    // Platform info
    isNative: false,
    platform: 'web' as const,
  };
};
