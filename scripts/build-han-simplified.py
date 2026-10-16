#!/usr/bin/env python3
"""Dựng data/han-simplified.json từ Unicode Unihan (giấy phép Unicode, dùng tự do).

  python3 scripts/build-han-simplified.py <thư mục đã giải nén Unihan.zip>

han-simplified.json: { phồn thể: giản thể } — để nối Hanja tiếng Hàn (phồn thể, vd 學) với chữ Trung
(giản thể, 学) khi gom "họ chữ" và khi tra âm Hán Việt.

KHÔNG lấy âm Hán Việt từ Unihan: trường kVietnamese lẫn âm Nôm (vd 檢 chỉ có "ghém", không có "kiểm") —
dạy sai cho người học. Âm Hán Việt còn thiếu do scripts/ai-enrich-zh-ko.mjs điền (data/hanviet-extra.json).
"""
import json, os, sys

src = sys.argv[1]

def cp(u):  # "U+5B78" -> "學"
    return chr(int(u[2:], 16))

def read(path, fields):
    out = {f: {} for f in fields}
    with open(os.path.join(src, path), encoding="utf-8") as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            code, field, value = line.rstrip("\n").split("\t", 2)
            if field in out:
                out[field][cp(code)] = value
    return out

variants = read("Unihan_Variants.txt", ["kSimplifiedVariant", "kTraditionalVariant"])

simplified = {}
for c, simps in variants["kSimplifiedVariant"].items():
    s = cp(simps.split()[0].split("<")[0])
    if s != c:
        simplified[c] = s

root = os.path.join(os.path.dirname(__file__), "..", "data")
with open(os.path.join(root, "han-simplified.json"), "w", encoding="utf-8") as f:
    json.dump(dict(sorted(simplified.items())), f, ensure_ascii=False, separators=(",", ":"))
print(f"han-simplified: {len(simplified)} cặp")
