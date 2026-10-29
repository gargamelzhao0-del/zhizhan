# split_dataset.py —— 生成会话数据，按"会话"切分训练/验证（避免数据泄漏）
import os, random
from collections import Counter

random.seed(7)
SESSIONS, PER_SESSION = 6, 20
labels = ["idle", "shake", "tilt"]

def make_dataset(root="dataset"):
    os.makedirs(os.path.join(root, "raw"), exist_ok=True)
    meta = []
    for s in range(SESSIONS):
        label = labels[s % len(labels)]
        for i in range(PER_SESSION):
            name = f"sess{s:02d}_{label}_{i:03d}.csv"
            open(os.path.join(root, "raw", name), "w").write("ax,ay,az\n0,0,1\n")
            meta.append({"file": name, "session": s, "label": label})
    return meta

def split(meta, val_ratio=0.34):
    sess = sorted({m["session"] for m in meta})
    n_val = max(1, round(len(sess) * val_ratio))
    val_sess = set(sess[-n_val:])                 # 按会话划分，而非按样本
    train = [m for m in meta if m["session"] not in val_sess]
    val   = [m for m in meta if m["session"] in val_sess]
    return train, val, sorted(val_sess)

if __name__ == "__main__":
    meta = make_dataset()
    train, val, vs = split(meta)
    print(f"sessions={len({m['session'] for m in meta})}  samples={len(meta)}")
    print(f"train={len(train)}  val={len(val)}  val_sessions={vs}")
    print("train labels:", dict(Counter(m["label"] for m in train)))
    print("val   labels:", dict(Counter(m["label"] for m in val)))
