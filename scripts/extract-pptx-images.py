#!/usr/bin/env python3
"""
Extract images from a PPTX and output them in slide order.

Usage: extract-pptx-images.py <pptx-path> <output-dir>

For each slide N (1-indexed), looks at the slide XML for <p:pic> picture
elements, finds their embedded image via the rels file, and copies the
largest such image as slide-NN.<ext>. Skips slides with no <p:pic> elements
(so background-only or text-only slides are excluded). Prints a JSON manifest.
"""
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def slide_index(name: str) -> int:
    m = re.search(r"slide(\d+)\.xml$", name)
    return int(m.group(1)) if m else -1


def picture_embed_ids(slide_xml: bytes) -> list[str]:
    """Return r:embed IDs of all <p:pic> picture elements on the slide."""
    root = ET.fromstring(slide_xml)
    ids = []
    # <p:pic>...<p:blipFill><a:blip r:embed="rId4"/></p:blipFill></p:pic>
    for pic in root.iter("{%s}pic" % NS["p"]):
        for blip in pic.iter("{%s}blip" % NS["a"]):
            rid = blip.attrib.get("{%s}embed" % NS["r"])
            if rid:
                ids.append(rid)
    return ids


def rels_map(rels_xml: bytes) -> dict[str, str]:
    """Return dict of rId -> resolved image path for image relationships."""
    root = ET.fromstring(rels_xml)
    out = {}
    for rel in root:
        rid = rel.attrib.get("Id", "")
        target = rel.attrib.get("Target", "")
        rel_type = rel.attrib.get("Type", "")
        if "image" in rel_type.lower() or target.startswith("../media/"):
            out[rid] = target.replace("../", "ppt/")
    return out


def extract(pptx_path: Path, out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest: dict[int, str] = {}

    with zipfile.ZipFile(pptx_path) as z:
        names = set(z.namelist())
        slide_names = sorted(
            (n for n in names if re.match(r"ppt/slides/slide\d+\.xml$", n)),
            key=slide_index,
        )

        for slide_name in slide_names:
            n = slide_index(slide_name)
            rels_name = f"ppt/slides/_rels/slide{n}.xml.rels"
            if rels_name not in names:
                continue

            with z.open(slide_name) as f:
                pic_ids = picture_embed_ids(f.read())
            if not pic_ids:
                continue

            with z.open(rels_name) as f:
                rmap = rels_map(f.read())

            candidates = []
            for rid in pic_ids:
                target = rmap.get(rid)
                if target and target in names:
                    candidates.append((z.getinfo(target).file_size, target))
            if not candidates:
                continue

            candidates.sort(reverse=True)
            _, src = candidates[0]
            ext = Path(src).suffix
            dest = out_dir / f"slide-{n:02d}{ext}"
            with z.open(src) as src_f, dest.open("wb") as dest_f:
                shutil.copyfileobj(src_f, dest_f)
            manifest[n] = dest.name

    return manifest


def main():
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    pptx = Path(sys.argv[1])
    out = Path(sys.argv[2])
    manifest = extract(pptx, out)
    print(json.dumps({str(k): v for k, v in sorted(manifest.items())}, indent=2))


if __name__ == "__main__":
    main()
