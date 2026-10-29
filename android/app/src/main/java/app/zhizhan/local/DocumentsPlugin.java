package app.zhizhan.local;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;

/** Streams bounded bridge chunks into a private staging file before invoking SAF. */
@CapacitorPlugin(name = "Documents")
public class DocumentsPlugin extends Plugin {
    private File pending;
    private String name;
    private String mime;
    private boolean picking;
    private static final long MAX_BYTES = 128L * 1024 * 1024;

    @PluginMethod public synchronized void beginSave(PluginCall call) {
        if (pending != null || picking) { call.reject("已有文件正在保存，请稍候"); return; }
        name = call.getString("name", "zhizhan-backup.zip").replaceAll("[\\\\/:*?\"<>|]", "_");
        mime = call.getString("mime", "application/octet-stream");
        try {
            pending = File.createTempFile("zhizhan-export-", ".tmp", getContext().getCacheDir());
            call.resolve();
        } catch (Exception e) { call.reject("无法创建临时文件", e); }
    }
    @PluginMethod public synchronized void appendSave(PluginCall call) {
        if (pending == null || picking) { call.reject("没有可写入的导出任务"); return; }
        String encoded = call.getString("data", "");
        if (encoded.length() > 280000) { call.reject("导出分片过大"); return; }
        try {
            byte[] bytes = Base64.decode(encoded, Base64.NO_WRAP);
            if (pending.length() + bytes.length > MAX_BYTES) { call.reject("导出文件超过容量限制"); return; }
            try (FileOutputStream out = new FileOutputStream(pending, true)) { out.write(bytes); }
            call.resolve();
        } catch (Exception e) { call.reject("写入导出文件失败", e); }
    }
    @PluginMethod public synchronized void finishSave(PluginCall call) {
        if (pending == null || picking) { call.reject("没有准备好的导出任务"); return; }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        picking = true;
        try { startActivityForResult(call, intent, "saveResult"); }
        catch (Exception e) { cleanup(); call.reject("无法打开系统文件保存器", e); }
    }
    @ActivityCallback private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) { cleanup(); return; }
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            cleanup(); JSObject data = new JSObject(); data.put("cancelled", true); call.resolve(data); return;
        }
        Uri uri = result.getData().getData();
        getBridge().execute(() -> {
            try {
                if (pending == null || uri == null) throw new IllegalStateException("导出临时文件已失效，请重新导出");
                try (FileInputStream in = new FileInputStream(pending);
                     OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                    if (out == null) throw new IllegalStateException("保存位置不可写");
                    byte[] buffer = new byte[65536]; int count;
                    while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
                    out.flush();
                }
                cleanup();
                call.resolve();
            } catch (Exception e) { cleanup(); call.reject("保存失败，目标文件可能不完整，请重新导出", e); }
        });
    }
    @PluginMethod public synchronized void cancelSave(PluginCall call) { cleanup(); call.resolve(); }
    private synchronized void cleanup() {
        if (pending != null) pending.delete();
        pending = null; picking = false;
    }
    @Override protected void handleOnDestroy() { cleanup(); }
}
