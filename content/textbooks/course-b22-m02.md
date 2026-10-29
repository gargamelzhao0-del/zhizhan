# 密码学的工程使用

```zhizhan-anchor
m02
```



第一条规则： **不要自己造算法** 。完整性用  **HMAC/AEAD** ，加密用 AES-GCM，随机用  **CSPRNG** ，比较用 **常量时间** 。

 

> 前置：会用 C 处理字节缓冲与十六进制，了解“完整性/认证/加密”的区别。 · ◷ 约 44 分钟 · ◈ 身份/固件/通信对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用 HMAC/AEAD \+ CSPRNG 做完整性校验，并识别 CRC 当安全、固定 IV、非安全随机等误用。



```zhizhan-anchor
m02-knowledge-boundary
```



### 运行标准算法，再讨论流程模型



labs/hmac\_sha256.py 使用 Python 标准库实现 HMAC-[SHA-256](term:sha)，并对拍 RFC 4231 两组向量，再测试错密钥、篡改和截断标签。host\_crypto.c 只保留为简化流程模型。P03 使用真实 Ed25519 验证签名，但闪存掉电与信任锚仍要由目标平台验证。



```text
python labs/hmac_sha256.py
```

 

本章速览




- 不要自己造密码；完整性用 HMAC/AEAD。

- 随机数用 CSPRNG；比较用常量时间。

- CRC 不是安全机制。

 

```zhizhan-anchor
m02-crypto
```



```zhizhan-anchor
m02-crypto-t
```



## 2.1 用途对应的算法



第一条规则：不要自己造算法。完整性/认证用 HMAC/AEAD，加密用 AES-GCM（非 ECB/固定 IV），随机用 CSPRNG，密钥派生用 HKDF/PBKDF2，比较用常量时间。



```zhizhan-anchor
fig-图-2-1
```



**图 2.1**  用途 → 算法



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="用途 → 算法" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">完整性/认证 → HMAC/AEAD</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">加密 → AES-GCM（禁 ECB/固定 IV）</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">随机 → CSPRNG（禁 rand/固定种子）</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="151.0" class="sv-lbl-hi">比较 → 常量时间（禁普通 memcmp）</text></svg>
```



完整性/认证 → HMAC/AEAD；加密 → AES-GCM；随机 → CSPRNG；比较 → 常量时间。



表 2.1 用途与算法



| 用途 | 算法 | 误用 |
| --- | --- | --- |
| 完整性/认证 | HMAC/AEAD | 用 CRC 当安全 |
| 加密 | AES-GCM 等 | ECB/固定 IV |
| 随机 | CSPRNG | rand()/固定种子 |
| 密钥派生 | HKDF/PBKDF2 | 直接哈希口令 |
| 比较 | 常量时间 | 普通 memcmp 泄露时序 |



```zhizhan-anchor
m02-evidence
```



```zhizhan-anchor
m02-evidence-t
```



## 2.2 真实证据：MAC 可复现与篡改检测



下面这段程序验证 MAC 可复现、篡改/错密钥被拒：



hmac\_sha256.pyPython

 

```text
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
```

标准库 HMAC-SHA-256 与 RFC 4231 独立向量



真实运行



$



```text
$ python labs/hmac_sha256.py
RFC4231 cases=2; tamper/wrong-key/truncated-tag rejected; RESULT: PASS
```



这些用例验证标准库调用与接口；不声称覆盖全部攻击。



表 2.2 完整性校验



| 情形 | 结果 | 说明 |
| --- | --- | --- |
| 相同输入 | MAC 相同 | 可复现 |
| 篡改 1 字节 | MAC 不等 | 检出 |
| 错误密钥 | MAC 不等 | 拒绝 |
| CRC | 可重算 | 不能当安全 |



```zhizhan-anchor
m02-misuse
```



```zhizhan-anchor
m02-misuse-t
```



## 2.3 常见误用



常见误用：CRC 当安全、固定/重复 IV、非安全随机、直接哈希口令、普通字符串比较（时序侧信道）。



crypto.c 节选C

 

```text
hmac(key, msg, mac);                       // 完整性/认证
if (ct_compare(mac, expect, n)) ok = 1;    // 常量时间比较
/* 随机用 CSPRNG；禁 CRC 当安全、固定 IV、普通 memcmp */
```

HMAC \+ 常量时间比较；避免常见误用



```zhizhan-anchor
m02-check
```



```zhizhan-anchor
m02-check-t
```



## 2.4 自检与成熟度对照



密码自检：用对算法、随机安全、比较常量时间、不造轮子。



```zhizhan-anchor
fig-图-2-2
```



**图 2.2**  完整性手段对比（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="完整性手段对比（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">MAC 可复现</text><rect x="150" y="26" width="300" height="18" rx="4" class="sv-grn-s"></rect><text x="458" y="43" class="sv-lbl-hi">1(标志)</text><text x="12" y="67" class="sv-lbl">篡改检测</text><rect x="150" y="50" width="300" height="18" rx="4" class="sv-grn-s"></rect><text x="458" y="67" class="sv-lbl-hi">1(标志)</text><text x="12" y="91" class="sv-lbl">错密钥拒绝</text><rect x="150" y="74" width="300" height="18" rx="4" class="sv-red-s"></rect><text x="458" y="91" class="sv-lbl-hi">1(标志)</text></svg>
```



简化流程对这两组输入产生不同结果；不能证明安全性。标准 HMAC-SHA-256 用 RFC 向量另验。



表 2.3 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 完整性 | HMAC/AEAD | CRC |
| 加密 | GCM\+随机IV | ECB/固定IV |
| 随机 | CSPRNG | rand |
| 比较 | 常量时间 | memcmp |



```zhizhan-anchor
m02-quick
```



```zhizhan-anchor
m02-quick-t
```



## 速查与常见错误



把本章的易错点与对策集中对照：



crypto.c 节选C

 

```text
hmac(key, msg, mac);                   // 完整性/认证
if (!ct_compare(mac, expect, n)) deny();// 常量时间比较
/* 随机用 CSPRNG；禁 CRC 当安全、固定 IV */
```

HMAC \+ 常量时间比较



表 2.4 误用与纠正



| 要点 | 正确做法 |
| --- | --- |
| CRC 当安全 | HMAC/AEAD |
| 固定 IV | 随机唯一 IV |
| rand 随机 | CSPRNG |
| 普通 memcmp | 常量时间比较 |



```zhizhan-anchor
m02-pitfalls
```



```zhizhan-anchor
m02-pitfalls-t
```



## 2.5 常见误区与排障



失败路径与排障




- **自己造算法** ：几乎必错。

- **CRC 当安全** ：可伪造。

- **非安全随机** ：密钥可预测。

- **普通比较** ：时序侧信道泄露。



◆ 自测 · Module 02（先答再看）




1. 为什么校验完整性和认证要用 HMAC 而不是 CRC？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"CRC 是公开算法、无密钥，攻击者改数据后可重算 CRC；HMAC 需要密钥，在算法假设、足够密钥强度及正确实现条件下，攻击者难以伪造，因此能提供认证。"}
   ```

2. 为什么加密不能用固定 IV？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"固定/重复 IV 会让相同明文产生相同密文，泄露模式信息甚至可被分析还原。nonce/IV 的要求取决于算法。GCM 在同一密钥下必须唯一；跨重启要保持唯一性，随机生成也需按碰撞风险限制使用量。"}
   ```

3. 为什么密钥比较要用“常量时间”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"普通 memcmp 会在第一个不同字节处提前返回，执行时间随匹配前缀变化，形成时序侧信道，可能被用来逐字节猜测密钥。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：审查完整性/加密/随机/比较用法，替换所有 CRC 当安全、固定 IV、非安全随机与普通比较。



核对与延伸：[NIST SP 800-57 密钥管理](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)

 

动手练习



运行 ` python labs/hmac_sha256.py `：对照 RFC 4231 向量，并拒绝篡改、错密钥和截短标签。



**检查结果：** 两个标准向量匹配；预设负例均拒绝。说明密钥、认证标签和消息的边界，不能用简化哈希替代标准 HMAC。

 

迁移练习：把本章的“能用 HMAC/AEAD \+ CSPRNG 做完整性校验，并识别 CRC 当安全、固定 IV、非安全随机等误用。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 02 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b22-m02","criterion":"两个标准向量匹配；预设负例均拒绝。说明密钥、认证标签和消息的边界，不能用简化哈希替代标准 HMAC。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b22-guide)
