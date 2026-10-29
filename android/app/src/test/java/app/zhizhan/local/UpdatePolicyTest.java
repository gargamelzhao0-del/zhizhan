package app.zhizhan.local;

import org.junit.Test;
import static org.junit.Assert.*;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Arrays;

public class UpdatePolicyTest {
    private interface Action { void run() throws Exception; }
    private void rejects(Action action) throws Exception {
        try { action.run(); fail("must reject"); } catch (IOException expected) { assertNotNull(expected.getMessage()); }
    }
    private final UpdatePolicy.Checkpoint alive = () -> {};
    @Test public void credentialsAreScopedToHttpsOriginIncludingPort() throws Exception {
        String token = "a".repeat(43), configured = "https://updates.example:8443/latest.json";
        assertEquals("Bearer " + token, UpdatePolicy.authorization(UpdatePolicy.https("https://updates.example:8443/a.apk"), configured, token));
        assertNull(UpdatePolicy.authorization(UpdatePolicy.https("https://evil.example/a.apk"), configured, token));
        assertNull(UpdatePolicy.authorization(UpdatePolicy.https("https://updates.example/a.apk"), configured, token));
        assertEquals("Bearer " + token, UpdatePolicy.authorization(UpdatePolicy.https("https://UPDATES.example:443/a.apk"), "https://updates.example/latest.json", token));
    }
    @Test public void malformedCredentialsCannotBecomeHeaders() throws Exception {
        rejects(() -> UpdatePolicy.authorization(UpdatePolicy.https("https://example.test/x"), "https://example.test/latest.json", "bad\r\nheader"));
        assertNull(UpdatePolicy.authorization(UpdatePolicy.https("https://example.test/x"), "", ""));
    }
    @Test public void onlyHttpsWithoutCredentialsOrFragments() throws Exception {
        assertEquals("https", UpdatePolicy.https("https://example.test/app.apk").getScheme());
        for (String url : new String[] {"http://example.test/x", "file:///x", "https://u:p@example.test/x", "https://example.test/x#y", "https://example.test:0/x"})
            rejects(() -> UpdatePolicy.https(url));
    }
    @Test public void refusesWrongAppDowngradeIncompatibleAndOversized() throws Exception {
        String sha = "a".repeat(64);
        UpdatePolicy.validateArtifact("app", "app", 5, 4, 26, 36, 10, sha);
        rejects(() -> UpdatePolicy.validateArtifact("other", "app", 5, 4, 26, 36, 10, sha));
        rejects(() -> UpdatePolicy.validateArtifact("app", "app", 4, 4, 26, 36, 10, sha));
        rejects(() -> UpdatePolicy.validateArtifact("app", "app", 5, 4, 37, 36, 10, sha));
        rejects(() -> UpdatePolicy.validateArtifact("app", "app", 5, 4, 26, 36, UpdatePolicy.MAX_APK_BYTES + 1, sha));
    }
    @Test public void comparesCompleteSignerSets() {
        byte[][] a = { {1, 2}, {3, 4} }, b = { {3, 4}, {1, 2} }, wrong = { {1, 2}, {5, 6} };
        assertTrue(UpdatePolicy.sameSigners(a, b)); assertFalse(UpdatePolicy.sameSigners(a, wrong));
        assertFalse(UpdatePolicy.sameSigners(a, null)); assertFalse(UpdatePolicy.sameSigners(new byte[0][], new byte[0][]));
    }
    @Test public void copiesAcrossBufferBoundariesAndChecksDigest() throws Exception {
        byte[] bytes = new byte[65536 * 2 + 19]; Arrays.fill(bytes, (byte)71);
        String hash = UpdatePolicy.hex(UpdatePolicy.sha256().digest(bytes));
        ByteArrayOutputStream out = new ByteArrayOutputStream(); final long[] progress = {0};
        UpdatePolicy.copyVerified(new ByteArrayInputStream(bytes), out, bytes.length, hash, alive, n -> progress[0] = n);
        assertArrayEquals(bytes, out.toByteArray()); assertEquals(bytes.length, progress[0]);
    }
    @Test public void rejectsTruncationExtraBytesAndCorruption() throws Exception {
        byte[] bytes = {1, 2, 3}; String hash = UpdatePolicy.hex(UpdatePolicy.sha256().digest(bytes));
        rejects(() -> UpdatePolicy.copyVerified(new ByteArrayInputStream(bytes), new ByteArrayOutputStream(), 4, hash, alive, n -> {}));
        rejects(() -> UpdatePolicy.copyVerified(new ByteArrayInputStream(bytes), new ByteArrayOutputStream(), 2, hash, alive, n -> {}));
        rejects(() -> UpdatePolicy.copyVerified(new ByteArrayInputStream(new byte[] {1, 2, 4}), new ByteArrayOutputStream(), 3, hash, alive, n -> {}));
    }
    @Test public void cancellationStopsBeforeFurtherWrites() throws Exception {
        byte[] bytes = new byte[70000]; String hash = UpdatePolicy.hex(UpdatePolicy.sha256().digest(bytes));
        ByteArrayOutputStream out = new ByteArrayOutputStream(); final boolean[] cancel = {false};
        rejects(() -> UpdatePolicy.copyVerified(new ByteArrayInputStream(bytes), out, bytes.length, hash,
            () -> { if (cancel[0]) throw new IOException("cancelled"); }, n -> cancel[0] = true));
        assertEquals(65536, out.size());
    }
    @Test public void limitsManifestEvenWithoutContentLength() throws Exception {
        byte[] good = new byte[UpdatePolicy.MAX_MANIFEST_BYTES];
        assertEquals(good.length, UpdatePolicy.readManifest(new ByteArrayInputStream(good), alive).length);
        rejects(() -> UpdatePolicy.readManifest(new ByteArrayInputStream(new byte[good.length + 1]), alive));
    }
}
