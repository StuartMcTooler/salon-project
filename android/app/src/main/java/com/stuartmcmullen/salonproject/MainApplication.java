package com.stuartmcmullen.salonproject;

import com.getcapacitor.BridgeActivity;
import com.stripe.stripeterminal.TerminalApplicationDelegate;

public class MainApplication extends android.app.Application {
    @Override
    public void onCreate() {
        super.onCreate();
        TerminalApplicationDelegate.onCreate(this);
    }
}
