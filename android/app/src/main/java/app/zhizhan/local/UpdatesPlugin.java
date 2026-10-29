package app.zhizhan.local;

import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;

/** Explicit self-update flow. HTTPS only, bounded downloads, same signer, user-driven installation. */
@CapacitorPlugin(name = "Updates")
public class UpdatesPlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicReference<Operation> active = new AtomicReference<>();
    private volatile Candidate ready;
    private File directory;

    private static final class Operation {
        final String id;
        final long deadline;
        volatile boolean cancelled;
        volatile HttpURLConnection connection;
        Operation(String id, int seconds) { this.id = id; deadline = System.nanoTime() + seconds * 1000000000L; }
        void check() throws IOException {
            if (cancelled || Thread.currentThread().isInterrupted()) throw new IOException("更新已取消");
            if (System.nanoTime() > deadline) throw new IOException("更新请求超时，请重试");
        }
        void cancel() { cancelled = true; HttpURLConnection c = connection; if (c != null) c.disconnect(); }
        void disconnect() { HttpURLConnection c = connection; connection = null; if (c != null) c.disconnect(); }
    }
    private static final class Candidate {
        final String appId, version, url, hash, operationId;
        final long code, bytes;
        final int minSdk;
        Candidate(JSONObject data, String operationId) throws Exception {
            appId = data.getString("appId"); version = data.getString("version");
            code = integer(data, "versionCode"); minSdk = Math.toIntExact(integer(data, "minSdk"));
            JSONObject apk = data.getJSONObject("apk");
            url = UpdatePolicy.https(apk.getString("url")).toString();
            hash = apk.getString("sha256"); bytes = integer(apk, "bytes");
            if (!version.matches("[0-9A-Za-z][0-9A-Za-z.+_-]{0,39}")) throw new IOException("版本名称无效");
            this.operationId = operationId;
        }
    }
    private static long integer(JSONObject json, String key) throws Exception {
        Object value = json.get(key);
        if (!(value instanceof Number)) throw new IOException("版本清单数值类型无效");
        double d = ((Number) value).doubleValue();
        if (!Double.isFinite(d) || d != Math.rint(d) || d < 0 || d > Integer.MAX_VALUE)
            throw new IOException("版本清单数值范围无效");
        return ((Number) value).longValue();
    }

    @Override public void load() {
        directory = new File(getContext().getCacheDir(), "updates");
        if (directory.isDirectory() || directory.mkdirs()) {
            new File(directory, "candidate.part").delete();
        }
    }
    private Operation begin(PluginCall call, int seconds) {
        String id = call.getString("operationId", "");
        if (!id.matches("[a-zA-Z0-9-]{1,64}")) { call.reject("更新任务标识无效"); return null; }
        Operation operation = new Operation(id, seconds);
        if (!active.compareAndSet(null, operation)) { call.reject("已有更新任务正在进行", "BUSY"); return null; }
        return operation;
    }
    private void success(Operation operation, PluginCall call, JSObject result) {
        operation.disconnect(); active.compareAndSet(operation, null); call.resolve(result);
    }
    private void failure(Operation operation, PluginCall call, Exception error) {
        operation.disconnect(); active.compareAndSet(operation, null);
        if (operation.cancelled) call.reject("更新已取消", "CANCELLED");
        else if (error instanceof IOException) call.reject(error.getMessage() == null ? "网络或文件操作失败，请重试" : error.getMessage(), "UPDATE_FAILED");
        else call.reject("更新文件格式或安装信息无效，请联系发布者", "UPDATE_INVALID");
    }
    private HttpURLConnection connect(String address, Operation operation) throws Exception {
        URI uri = UpdatePolicy.https(address);
        boolean protectedRequest = UpdatePolicy.authorization(uri, BuildConfig.UPDATE_URL, BuildConfig.UPDATE_TOKEN) != null;
        for (int redirects = 0; redirects <= 3; redirects++) {
            operation.check();
            String authorization = UpdatePolicy.authorization(uri, BuildConfig.UPDATE_URL, BuildConfig.UPDATE_TOKEN);
            if (protectedRequest && authorization == null) throw new IOException("更新入口跳转到未授权服务器，已停止连接");
            HttpURLConnection connection = (HttpURLConnection) uri.toURL().openConnection();
            operation.connection = connection;
            connection.setConnectTimeout(10000); connection.setReadTimeout(15000);
            connection.setInstanceFollowRedirects(false); connection.setUseCaches(false);
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("Cache-Control", "no-cache");
            if (authorization != null) connection.setRequestProperty("Authorization", authorization);
            int code = connection.getResponseCode();
            operation.check();
            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                String location = connection.getHeaderField("Location");
                operation.disconnect();
                if (location == null || redirects == 3) throw new IOException("更新地址重定向异常");
                uri = UpdatePolicy.https(uri.resolve(location).toString());
                continue;
            }
            if (code != 200) throw new IOException("更新服务器返回 HTTP " + code);
            String encoding = connection.getContentEncoding();
            if (encoding != null && !encoding.equalsIgnoreCase("identity")) throw new IOException("更新服务器应提供未额外压缩的文件");
            return connection;
        }
        throw new IOException("更新地址无法访问");
    }

    @SuppressWarnings("deprecation")
    private PackageInfo installed() throws Exception {
        return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(),
            Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES);
    }
    @SuppressWarnings("deprecation")
    private static long code(PackageInfo info) { return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode; }
    @SuppressWarnings("deprecation")
    private static byte[][] certificates(PackageInfo info) {
        Signature[] signatures = Build.VERSION.SDK_INT >= 28
            ? (info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners()) : info.signatures;
        if (signatures == null) return null;
        byte[][] result = new byte[signatures.length][];
        for (int i = 0; i < signatures.length; i++) result[i] = signatures[i].toByteArray();
        return result;
    }
    @PluginMethod public void getInfo(PluginCall call) {
        try {
            PackageInfo info = installed(); JSObject result = new JSObject();
            result.put("appId", info.packageName); result.put("version", info.versionName);
            result.put("versionCode", code(info)); result.put("sdk", Build.VERSION.SDK_INT);
            call.resolve(result);
        } catch (Exception e) { call.reject("无法读取当前应用版本"); }
    }
    @PluginMethod public void getService(PluginCall call) {
        JSObject result = new JSObject();
        result.put("url", BuildConfig.UPDATE_URL);
        result.put("managed", !BuildConfig.UPDATE_URL.isEmpty());
        call.resolve(result);
    }
    @PluginMethod public void check(PluginCall call) {
        Operation operation = begin(call, 45); if (operation == null) return;
        worker.execute(() -> {
            try {
                HttpURLConnection connection = connect(call.getString("url", ""), operation);
                long length = connection.getContentLengthLong();
                if (length > UpdatePolicy.MAX_MANIFEST_BYTES) throw new IOException("版本清单超过 64 KiB");
                byte[] bytes;
                try (InputStream input = connection.getInputStream()) { bytes = UpdatePolicy.readManifest(input, operation::check); }
                JSObject result = new JSObject(); result.put("text", new String(bytes, StandardCharsets.UTF_8));
                result.put("url", connection.getURL().toString());
                success(operation, call, result);
            } catch (Exception e) { failure(operation, call, e); }
        });
    }
    @SuppressWarnings("deprecation")
    private void verifyPackage(File file, Candidate candidate) throws Exception {
        PackageManager manager = getContext().getPackageManager();
        PackageInfo original = installed();
        UpdatePolicy.validateArtifact(candidate.appId, original.packageName, candidate.code, code(original),
            candidate.minSdk, Build.VERSION.SDK_INT, candidate.bytes, candidate.hash);
        PackageInfo apk = manager.getPackageArchiveInfo(file.getAbsolutePath(),
            Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES);
        if (apk == null || apk.applicationInfo == null) throw new IOException("文件不是可识别的 Android 安装包");
        if (!candidate.appId.equals(apk.packageName) || candidate.code != code(apk) || !candidate.version.equals(apk.versionName) ||
            candidate.minSdk != apk.applicationInfo.minSdkVersion) throw new IOException("安装包身份或版本与清单不符");
        if (!UpdatePolicy.sameSigners(certificates(original), certificates(apk)))
            throw new IOException("安装包签名与当前知栈不一致，已拒绝安装");
    }
    @PluginMethod public void download(PluginCall call) {
        Operation operation = begin(call, 600); if (operation == null) return;
        worker.execute(() -> {
            File part = new File(directory, "candidate.part"), verified = new File(directory, "verified.apk");
            ready = null; verified.delete();
            try {
                Candidate candidate = new Candidate(call.getObject("manifest"), operation.id);
                PackageInfo info = installed();
                UpdatePolicy.validateArtifact(candidate.appId, info.packageName, candidate.code, code(info), candidate.minSdk,
                    Build.VERSION.SDK_INT, candidate.bytes, candidate.hash);
                if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("无法创建更新缓存");
                if (directory.getUsableSpace() < candidate.bytes + 16L * 1024 * 1024) throw new IOException("可用存储空间不足，请释放空间后重试");
                HttpURLConnection connection = connect(candidate.url, operation);
                long length = connection.getContentLengthLong();
                if (length >= 0 && length != candidate.bytes) throw new IOException("安装包长度与清单不一致");
                final long[] lastEvent = {0};
                try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(part)) {
                    UpdatePolicy.copyVerified(input, output, candidate.bytes, candidate.hash, operation::check, bytes -> {
                        long now = System.nanoTime();
                        if (now - lastEvent[0] >= 200000000L || bytes == candidate.bytes) {
                            JSObject event = new JSObject(); event.put("operationId", operation.id);
                            event.put("received", bytes); event.put("total", candidate.bytes);
                            notifyListeners("updateProgress", event); lastEvent[0] = now;
                        }
                    });
                    output.getFD().sync();
                }
                operation.check(); verifyPackage(part, candidate); operation.check();
                if (!part.renameTo(verified)) throw new IOException("无法保存已校验的安装包");
                ready = candidate;
                if (operation.cancelled) { ready = null; verified.delete(); operation.check(); }
                JSObject result = new JSObject(); result.put("verified", true);
                success(operation, call, result);
            } catch (Exception e) { part.delete(); ready = null; verified.delete(); failure(operation, call, e); }
        });
    }
    @PluginMethod public void cancel(PluginCall call) {
        String id = call.getString("operationId", "");
        Operation operation = active.get();
        if (operation != null && operation.id.equals(id)) operation.cancel();
        else if (ready != null && ready.operationId.equals(id)) {
            ready = null; new File(directory, "verified.apk").delete();
        }
        call.resolve();
    }
    @PluginMethod public void install(PluginCall call) {
        Operation operation = begin(call, 45); if (operation == null) return;
        worker.execute(() -> {
            try {
                Candidate candidate = ready;
                if (candidate == null) throw new IOException("安装包缓存已失效，请重新下载");
                File file = new File(directory, "verified.apk");
                try (InputStream input = new FileInputStream(file)) {
                    UpdatePolicy.copyVerified(input, new java.io.OutputStream() { @Override public void write(int b) {} @Override public void write(byte[] b, int off, int len) {} },
                        candidate.bytes, candidate.hash, operation::check, bytes -> {});
                }
                verifyPackage(file, candidate); operation.check();
                getActivity().runOnUiThread(() -> {
                    try {
                        operation.check(); JSObject result = new JSObject();
                        if (!getContext().getPackageManager().canRequestPackageInstalls()) {
                            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                            getActivity().startActivity(settings);
                            result.put("needsPermission", true);
                        } else {
                            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
                            Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive");
                            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            intent.setClipData(ClipData.newRawUri("知栈安装包", uri));
                            getActivity().startActivity(intent);
                            result.put("launched", true);
                        }
                        success(operation, call, result);
                    } catch (Exception e) { failure(operation, call, e); }
                });
            } catch (Exception e) { failure(operation, call, e); }
        });
    }
    @Override protected void handleOnDestroy() {
        Operation operation = active.get(); if (operation != null) operation.cancel();
        worker.shutdownNow();
        // Keep verified.apk while the system installer may still be reading it.
    }
}
