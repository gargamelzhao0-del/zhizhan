"""标准 HMAC-SHA-256；RFC 4231 向量及负例，Python 3.11+。"""
import hashlib
import hmac

def authenticate(key: bytes, message: bytes, expected: bytes) -> bool:
    actual = hmac.new(key, message, hashlib.sha256).digest()
    return hmac.compare_digest(actual, expected)

def main():
    cases = [
        (bytes.fromhex("0b" * 20), b"Hi There", "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7"),
        (b"Jefe", b"what do ya want for nothing?", "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"),
    ]
    for key, message, tag in cases:
        expected = bytes.fromhex(tag)
        assert authenticate(key, message, expected)
        assert not authenticate(key, message + b"!", expected)
        assert not authenticate(key + b"x", message, expected)
        assert not authenticate(key, message, expected[:-1])
    print("RFC4231 cases=2; tamper/wrong-key/truncated-tag rejected; RESULT: PASS")

if __name__ == "__main__":
    main()
