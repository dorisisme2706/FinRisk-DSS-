from __future__ import annotations
import hashlib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from .common import need, SEED

def make_split(df):
    need(df["sk_id_curr"].notna().all() and df["sk_id_curr"].is_unique, "ID must be nonmissing and unique.")
    need(df["target"].notna().all() and df["target"].isin([0, 1]).all(), "TARGET must be binary and nonmissing.")
    base = df[["sk_id_curr", "target"]].sort_values("sk_id_curr").reset_index(drop=True)
    idx = np.arange(len(base))
    trainval, test = train_test_split(idx, test_size=0.15, stratify=base["target"], random_state=SEED)
    train, validation = train_test_split(trainval, test_size=0.15/0.85,
                                        stratify=base.iloc[trainval]["target"], random_state=SEED)
    parts = {"train": train, "validation": validation, "test": test}
    assigned = []
    summary = {}
    for name, indices in parts.items():
        sub = base.iloc[indices]
        assigned.append(pd.DataFrame({"sk_id_curr": sub["sk_id_curr"].to_numpy(), "split": name}))
        counts = {str(k): int(v) for k, v in sub["target"].value_counts().items()}
        summary[name] = {"rows": len(sub), "target_counts": counts, "positive_rate": float(sub["target"].mean())}
    manifest = pd.concat(assigned, ignore_index=True).sort_values("sk_id_curr").reset_index(drop=True)
    need(len(manifest) == len(df) and manifest["sk_id_curr"].is_unique, "Split has duplicate/missing IDs.")
    need(set(manifest["sk_id_curr"]) == set(df["sk_id_curr"]), "Split population changed.")
    sets = {name: set(manifest.loc[manifest["split"] == name, "sk_id_curr"]) for name in parts}
    need(not (sets["train"] & sets["validation"] or sets["train"] & sets["test"] or sets["validation"] & sets["test"]), "Split overlap.")
    return manifest, summary

def split_bytes(manifest):
    return manifest.to_csv(index=False, lineterminator="\n").encode("utf-8")

def split_digest(manifest):
    return hashlib.sha256(split_bytes(manifest)).hexdigest()
