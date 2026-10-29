package app.zhizhan.local;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(DocumentsPlugin.class);
        registerPlugin(UpdatesPlugin.class);
        super.onCreate(state);
    }
}
