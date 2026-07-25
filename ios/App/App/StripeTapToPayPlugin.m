#if ENABLE_IOS_TAP_TO_PAY
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(StripeTapToPayPlugin, "StripeTapToPay",
           CAP_PLUGIN_METHOD(initialize, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(setConnectionToken, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(discoverReaders, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(connectReader, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(disconnectReader, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(collectPaymentMethod, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(confirmPaymentIntent, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(cancelPaymentIntent, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(isDeviceCapable, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(presentTapToPayEducation, CAPPluginReturnPromise);
)
#endif
