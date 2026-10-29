package app.zhizhan.local;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashSet;
import java.util.Set;

/** Platform-independent limits and transfer checks, shared with JVM tests. */
public final class UpdatePolicy {
    public static final long MAX_APK_BYTES = 128L * 1024 * 1024;
    public static final int MAX_MANIFEST_BYTES = 64 * 1024;
    private UpdatePolicy() {}

    public static boolean sameOrigin(URI first, URI second) {
        return first.getScheme().equalsIgnoreCase(second.getScheme()) &&
            first.getHost().equalsIgnoreCase(second.getHost()) &&
            (first.getPort() < 0 ? 443 : first.getPort()) == (second.getPort() < 0 ? 443 : second.getPort());
    }
    public static String authorization(URI request, String configuredUrl, String token) throws IOException {
        if (configuredUrl == null || configuredUrl.isEmpty()) return null;
        URI configured = https(configuredUrl);
        if (!sameOrigin(request, configured)) return null;
        if (token == null || !token.matches("[A-Za-z0-9_-]{43,128}")) throw new IOException("更新服务配置无效，请联系发布者");
        return "Bearer " + token;
    }

    public interface Checkpoint { void check() throws IOException; }
    public interface Progress { void update(long bytes); }

    public static URI https(String value) throws IOException {
        try {
            if (value == null || value.length() > 2048) throw new IllegalArgumentException();
            URI uri = new URI(value);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null ||
                uri.getHost().isEmpty() || uri.getRawUserInfo() != null || uri.getRawFragment() != null ||
                uri.getPort() == 0 || uri.getPort() > 65535) throw new IllegalArgumentException();
            return uri;
        } catch (Exception e) { throw new IOException("更新地址必须是有效的 HTTPS 地址，不能包含账号或片段"); }
    }

    public static MessageDigest sha256() {
        try { return MessageDigest.getInstance("SHA-256"); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    public static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) result.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
        return result.toString();
    }

    public static void validateArtifact(String appId, String installedId, long code, long current,
                                        int minSdk, int sdk, long bytes, String hash) throws IOException {
        if (!installedId.equals(appId)) throw new IOException("安装包属于其他应用");
        if (code <= current || code > Integer.MAX_VALUE) throw new IOException("仅允许安装高于当前版本的更新");
        if (minSdk < 26 || minSdk > sdk) throw new IOException("新版不支持当前 Android 系统");
        if (bytes <= 0 || bytes > MAX_APK_BYTES) throw new IOException("安装包大小无效或超过 128 MiB");
        if (hash == null || !hash.matches("[a-fA-F0-9]{64}")) throw new IOException("安装包缺少有效 SHA-256");
    }

    public static boolean sameSigners(byte[][] installed, byte[][] incoming) {
        if (installed == null || incoming == null || installed.length == 0 || installed.length != incoming.length) return false;
        Set<String> a = new HashSet<>(), b = new HashSet<>();
        for (byte[] cert : installed) a.add(hex(sha256().digest(cert)));
        for (byte[] cert : incoming) b.add(hex(sha256().digest(cert)));
        return a.size() == installed.length && a.equals(b);
    }

    public static byte[] readManifest(InputStream input, Checkpoint check) throws IOException {
        java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int count;
        for (;;) {
            check.check();
            count = input.read(buffer);
            if (count == -1) break;
            if (output.size() + count > MAX_MANIFEST_BYTES) throw new IOException("版本清单超过 64 KiB");
            output.write(buffer, 0, count);
        }
        check.check();
        return output.toByteArray();
    }

    public static void copyVerified(InputStream input, OutputStream output, long expectedBytes,
                                    String expectedHash, Checkpoint check, Progress progress) throws IOException {
        if (expectedBytes <= 0 || expectedBytes > MAX_APK_BYTES) throw new IOException("安装包大小无效");
        MessageDigest hash = sha256();
        byte[] buffer = new byte[65536];
        long total = 0;
        for (;;) {
            check.check();
            int count = input.read(buffer);
            if (count == -1) break;
            if (count > expectedBytes - total) throw new IOException("安装包超过清单声明大小");
            output.write(buffer, 0, count);
            hash.update(buffer, 0, count);
            total += count;
            progress.update(total);
        }
        check.check();
        if (total != expectedBytes) throw new IOException("安装包不完整，请重新下载");
        if (!hex(hash.digest()).equalsIgnoreCase(expectedHash)) throw new IOException("安装包校验失败，请重新检查更新");
        output.flush();
    }
}
