#!/usr/bin/env python3
"""Gộp âm Hán Việt soạn sẵn vào data/hanviet-extra.json, có kiểm tra.

  python3 scripts/merge-hanviet.py <thư mục Unihan> <file.txt> [...]

Mỗi dòng: "<chữ> <âm Hán Việt>" (hoặc nhiều cặp nối bằng "|"). Âm phải là đúng 1 âm tiết tiếng Việt viết thường. Đối chiếu với
Unihan kVietnamese (của chữ và dạng phồn thể tương ứng) — chỉ để BÁO chỗ lệch cho người soát, không tự loại:
kVietnamese lẫn âm Nôm (vd 檢 chỉ có "ghém") nên lệch chưa chắc là sai.
"""
import json, os, re, sys

unihan, files = sys.argv[1], sys.argv[2:]
SYL = re.compile(r"^[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+$")

def cp(u):
    return chr(int(u[2:], 16))

viet, trad = {}, {}
for line in open(os.path.join(unihan, "Unihan_Readings.txt"), encoding="utf-8"):
    if "\tkVietnamese\t" in line:
        code, _, v = line.rstrip("\n").split("\t")
        viet[cp(code)] = set(v.lower().split())
for line in open(os.path.join(unihan, "Unihan_Variants.txt"), encoding="utf-8"):
    p = line.rstrip("\n").split("\t")
    if len(p) == 3 and p[1] == "kTraditionalVariant":
        trad[cp(p[0])] = [cp(x.split("<")[0]) for x in p[2].split()]

path = os.path.join(os.path.dirname(__file__), "..", "data", "hanviet-extra.json")
extra = json.load(open(path, encoding="utf-8"))
added = agree = known = 0
bad, differ = [], []
for f in files:
    # Mỗi dòng 1 cặp, hoặc nhiều cặp nối bằng "|" ("之 chi|年 niên")
    for line in (seg for raw in open(f, encoding="utf-8") for seg in raw.split("|")):
        parts = line.split()
        if len(parts) != 2:
            continue
        c, hv = parts[0], parts[1].lower()
        if len(c) != 1 or not SYL.match(hv):
            bad.append(line.strip())
            continue
        refs = set(viet.get(c, set()))
        for t in trad.get(c, []):
            refs |= viet.get(t, set())
        if refs:
            known += 1
            if hv in refs:
                agree += 1
            else:
                differ.append(f"{c}={hv} (Unihan: {'/'.join(sorted(refs))})")
        if extra.get(c) != hv:
            added += 1
        extra[c] = hv

with open(path, "w", encoding="utf-8") as fh:
    json.dump(dict(sorted(extra.items())), fh, ensure_ascii=False, separators=(",", ":"))
    fh.write("\n")
print(f"+{added} chữ (tổng {len(extra)}). Khớp Unihan {agree}/{known} chữ Unihan có dữ liệu.")
if bad:
    print("Dòng sai định dạng:", " | ".join(bad))
if differ:
    print(f"Lệch Unihan ({len(differ)}) — soát lại:", " · ".join(differ))
