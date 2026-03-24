package com.stuartmcmullen.salonproject;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.stripe.stripeterminal.Terminal;
import com.stripe.stripeterminal.external.callable.Callback;
import com.stripe.stripeterminal.external.callable.ConnectionTokenCallback;
import com.stripe.stripeterminal.external.callable.ConnectionTokenProvider;
import com.stripe.stripeterminal.external.callable.DiscoveryListener;
import com.stripe.stripeterminal.external.callable.PaymentIntentCallback;
import com.stripe.stripeterminal.external.callable.ReaderCallback;
import com.stripe.stripeterminal.external.callable.TapToPayReaderListener;
import com.stripe.stripeterminal.external.callable.TerminalListener;
import com.stripe.stripeterminal.external.models.ConnectionConfiguration;
import com.stripe.stripeterminal.external.models.DisconnectReason;
import com.stripe.stripeterminal.external.models.DiscoveryConfiguration;
import com.stripe.stripeterminal.external.models.PaymentIntent;
import com.stripe.stripeterminal.external.models.Reader;
import com.stripe.stripeterminal.external.models.TerminalException;
import com.stripe.stripeterminal.log.LogLevel;

import org.json.JSONArray;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "StripeTapToPay")
public class StripeTapToPayPlugin extends Plugin implements ConnectionTokenProvider, DiscoveryListener, TapToPayReaderListener {
    private static final String TAG = "StripeTapToPay";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private ConnectionTokenCallback connectionTokenCallback;
    private final List<Reader> discoveredReaders = new ArrayList<>();
    private PluginCall pendingDiscoverCall;
    private PaymentIntent currentPaymentIntent;
    private String lastLocationId;

    @PluginMethod
    public void initialize(PluginCall call) {
        Log.d(TAG, "initialize() called");
        mainHandler.post(() -> {
            try {
                if (!Terminal.isInitialized()) {
                    Terminal.init(
                        getContext().getApplicationContext(),
                        LogLevel.VERBOSE,
                        this,
                        new TerminalListener() {},
                        null
                    );
                }
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage(), e);
            }
        });
    }

    @Override
    public void fetchConnectionToken(@NonNull ConnectionTokenCallback callback) {
        if (connectionTokenCallback != null) {
            Log.d(TAG, "Ignoring duplicate token request while one is already pending");
            return;
        }
        Log.d(TAG, "fetchConnectionToken requested by SDK");
        connectionTokenCallback = callback;
        notifyListeners("requestedConnectionToken", new JSObject());
    }

    @PluginMethod
    public void setConnectionToken(PluginCall call) {
        String token = call.getString("token");
        if (token == null || token.isEmpty()) {
            call.reject("Missing connection token");
            return;
        }

        if (connectionTokenCallback != null) {
            Log.d(TAG, "setConnectionToken received token, completing pending request");
            connectionTokenCallback.onSuccess(token);
            connectionTokenCallback = null;
        } else {
            Log.d(TAG, "setConnectionToken received token but no pending completion exists");
        }
        call.resolve();
    }

    @PluginMethod
    public void discoverReaders(PluginCall call) {
        mainHandler.post(() -> {
            try {
                if (!Terminal.isInitialized()) {
                    call.reject("Terminal not initialized");
                    return;
                }

                boolean isSimulated = Boolean.TRUE.equals(call.getBoolean("isSimulated", false));
                String locationId = call.getString("locationId");
                lastLocationId = locationId;
                pendingDiscoverCall = call;
                discoveredReaders.clear();

                DiscoveryConfiguration config = new DiscoveryConfiguration.TapToPayDiscoveryConfiguration(isSimulated);
                Terminal.getInstance().discoverReaders(config, this, new Callback() {
                    @Override
                    public void onSuccess() {
                        Log.d(TAG, "discoverReaders completed");
                        if (pendingDiscoverCall != null) {
                            JSObject result = new JSObject();
                            result.put("readers", serializeReaders(discoveredReaders));
                            pendingDiscoverCall.resolve(result);
                            pendingDiscoverCall = null;
                        }
                    }

                    @Override
                    public void onFailure(@NonNull TerminalException e) {
                        Log.e(TAG, "discoverReaders failed", e);
                        if (pendingDiscoverCall != null) {
                            pendingDiscoverCall.reject(e.getErrorMessage(), e);
                            pendingDiscoverCall = null;
                        }
                    }
                });
            } catch (Exception e) {
                call.reject(e.getMessage(), e);
            }
        });
    }

    @Override
    public void onUpdateDiscoveredReaders(@NonNull List<Reader> readers) {
        Log.d(TAG, "discoverReaders emitted " + readers.size() + " readers");
        discoveredReaders.clear();
        discoveredReaders.addAll(readers);
        if (pendingDiscoverCall != null) {
            JSObject result = new JSObject();
            result.put("readers", serializeReaders(readers));
            pendingDiscoverCall.resolve(result);
            pendingDiscoverCall = null;
        }
    }

    @PluginMethod
    public void connectReader(PluginCall call) {
        mainHandler.post(() -> {
            try {
                JSObject readerObj = call.getObject("reader");
                if (readerObj == null) {
                    call.reject("Missing reader");
                    return;
                }
                Reader reader = lookupReader(readerObj);
                if (reader == null) {
                    call.reject("Reader not found");
                    return;
                }
                String locationId = call.getString("locationId");
                if (locationId == null || locationId.isEmpty()) {
                    locationId = lastLocationId;
                }
                if (locationId == null || locationId.isEmpty()) {
                    call.reject("Missing locationId for Tap to Pay");
                    return;
                }

                ConnectionConfiguration.TapToPayConnectionConfiguration config = new ConnectionConfiguration.TapToPayConnectionConfiguration(locationId, this);
                Terminal.getInstance().connectReader(reader, config, new ReaderCallback() {
                    @Override
                    public void onSuccess(@NonNull Reader reader) {
                        JSObject result = new JSObject();
                        result.put("reader", serializeReader(reader));
                        call.resolve(result);
                    }

                    @Override
                    public void onFailure(@NonNull TerminalException e) {
                        call.reject(e.getErrorMessage(), e);
                    }
                });
            } catch (Exception e) {
                call.reject(e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void disconnectReader(PluginCall call) {
        Terminal.getInstance().disconnectReader(new Callback() {
            @Override
            public void onSuccess() {
                call.resolve();
            }

            @Override
            public void onFailure(@NonNull TerminalException e) {
                call.reject(e.getErrorMessage(), e);
            }
        });
    }

    @PluginMethod
    public void collectPaymentMethod(PluginCall call) {
        String clientSecret = call.getString("paymentIntent");
        if (clientSecret == null || clientSecret.isEmpty()) {
            call.reject("Missing paymentIntent client secret");
            return;
        }

        Terminal.getInstance().retrievePaymentIntent(clientSecret, new PaymentIntentCallback() {
            @Override
            public void onSuccess(@NonNull PaymentIntent paymentIntent) {
                currentPaymentIntent = paymentIntent;
                Terminal.getInstance().collectPaymentMethod(paymentIntent, new PaymentIntentCallback() {
                    @Override
                    public void onSuccess(@NonNull PaymentIntent paymentIntent) {
                        currentPaymentIntent = paymentIntent;
                        JSObject result = new JSObject();
                        result.put("paymentIntent", serializePaymentIntent(paymentIntent));
                        call.resolve(result);
                    }

                    @Override
                    public void onFailure(@NonNull TerminalException e) {
                        call.reject(e.getErrorMessage(), e);
                    }
                });
            }

            @Override
            public void onFailure(@NonNull TerminalException e) {
                call.reject(e.getErrorMessage(), e);
            }
        });
    }

    @PluginMethod
    public void confirmPaymentIntent(PluginCall call) {
        if (currentPaymentIntent == null) {
            call.reject("No PaymentIntent available to confirm");
            return;
        }
        Terminal.getInstance().confirmPaymentIntent(currentPaymentIntent, new PaymentIntentCallback() {
            @Override
            public void onSuccess(@NonNull PaymentIntent paymentIntent) {
                currentPaymentIntent = paymentIntent;
                JSObject result = new JSObject();
                result.put("paymentIntent", serializePaymentIntent(paymentIntent));
                call.resolve(result);
            }

            @Override
            public void onFailure(@NonNull TerminalException e) {
                call.reject(e.getErrorMessage(), e);
            }
        });
    }

    @PluginMethod
    public void cancelPaymentIntent(PluginCall call) {
        if (currentPaymentIntent == null) {
            call.reject("No PaymentIntent available to cancel");
            return;
        }
        Terminal.getInstance().cancelPaymentIntent(currentPaymentIntent, new PaymentIntentCallback() {
            @Override
            public void onSuccess(@NonNull PaymentIntent paymentIntent) {
                currentPaymentIntent = paymentIntent;
                JSObject result = new JSObject();
                result.put("paymentIntent", serializePaymentIntent(paymentIntent));
                call.resolve(result);
            }

            @Override
            public void onFailure(@NonNull TerminalException e) {
                call.reject(e.getErrorMessage(), e);
            }
        });
    }

    @PluginMethod
    public void isDeviceCapable(PluginCall call) {
        JSObject result = new JSObject();
        boolean hasNfc = getContext().getPackageManager().hasSystemFeature(android.content.pm.PackageManager.FEATURE_NFC);
        result.put("value", hasNfc);
        if (!hasNfc) {
            result.put("error", "NFC not supported on this device");
        }
        call.resolve(result);
    }

    private Reader lookupReader(JSObject readerObj) {
        String serial = readerObj.getString("serialNumber");
        if (serial != null) {
            for (Reader reader : discoveredReaders) {
                if (serial.equals(reader.getSerialNumber())) {
                    return reader;
                }
            }
        }
        return discoveredReaders.isEmpty() ? null : discoveredReaders.get(0);
    }

    private JSONArray serializeReaders(List<Reader> readers) {
        JSONArray arr = new JSONArray();
        for (Reader reader : readers) {
            arr.put(serializeReader(reader));
        }
        return arr;
    }

    private JSObject serializeReader(Reader reader) {
        JSObject obj = new JSObject();
        obj.put("serialNumber", reader.getSerialNumber());
        obj.put("stripeId", reader.getId());
        obj.put("deviceType", "tap_to_pay");
        obj.put("locationId", reader.getLocation() != null ? reader.getLocation().getId() : lastLocationId);
        obj.put("label", reader.getLabel());
        obj.put("simulated", reader.isSimulated());
        return obj;
    }

    private JSObject serializePaymentIntent(PaymentIntent paymentIntent) {
        JSObject obj = new JSObject();
        obj.put("id", paymentIntent.getId());
        obj.put("clientSecret", paymentIntent.getClientSecret());
        obj.put("amount", paymentIntent.getAmount());
        obj.put("currency", paymentIntent.getCurrency());
        obj.put("livemode", paymentIntent.getLivemode());
        return obj;
    }

    @Override
    public void onDisconnect(@NonNull DisconnectReason reason) { }
}
