#!/usr/bin/env python3
"""Import the reading tracker spreadsheet into Hugo data files.

Usage:
  python scripts/import_reading_tracker_xlsx.py
  python scripts/import_reading_tracker_xlsx.py --xlsx "D:\\Downloads\\Tareas.xlsx"
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import re
import unicodedata
import urllib.parse
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
import xml.etree.ElementTree as ET


NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"a": NS_MAIN, "r": NS_REL}

COL_AREA = "A"
COL_SUB_AREA = "B"
COL_SUB_SUB_AREA = "C"
COL_AUTHOR = "D"
COL_TITLE = "E"
COL_CHAPTER = "F"
COL_YEAR = "G"
COL_START = "H"
COL_END = "I"
COL_CURRENT = "J"
COL_TOTAL = "K"

DEFAULT_XLSX = Path(r"D:\Downloads\Tareas.xlsx")
DEFAULT_I_CIENCIA_ROOT = Path(r"content/Notas/I. Ciencia")
DEFAULT_GRAPH_CONFIG = Path(r"data/graphConfig.yaml")
DEFAULT_OUTPUT = Path(r"data/reading_tracker.yaml")

FALLBACK_COLORS = [
    "#8fb6d8",
    "#b59bd9",
    "#d6ae8a",
    "#9ec7a8",
    "#d99fb3",
    "#a8b2d8",
    "#d8c28f",
]


@dataclass
class FolderNode:
    label: str
    norm_label: str
    path_labels: Tuple[str, ...]
    children: List["FolderNode"]


def strip_number_prefix(text: str) -> str:
    value = text.strip()
    value = re.sub(r"^\d+(?:\.\d+)*\.\s*", "", value)
    value = re.sub(r"^\d+(?:\.\d+)*\.-\s*", "", value)
    return value.strip()


def normalize_label(text: str) -> str:
    if not text:
        return ""
    value = strip_number_prefix(text)
    value = value.replace("—", " ").replace("-", " ")
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.casefold()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def slugify(text: str) -> str:
    norm = normalize_label(text)
    if not norm:
        raw = unicodedata.normalize("NFKC", text).strip()
        if raw:
            codepoints = "-".join(f"{ord(ch):x}" for ch in raw if not ch.isspace())
            return f"u-{codepoints[:48]}"
        return "item"
    slug = norm.replace(" ", "-")
    return slug or "item"


def yaml_scalar(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    return json.dumps(str(value), ensure_ascii=False)


def parse_graph_area_colors(graph_config_path: Path) -> Dict[str, str]:
    if not graph_config_path.exists():
        return {}
    colors: Dict[str, str] = {}
    pattern = re.compile(
        r'^\s*-\s*(/Notas/I\.-Ciencia/[^:]+):\s*"?((?:#[0-9a-fA-F]{6}))"?\s*$'
    )
    for line in graph_config_path.read_text(encoding="utf-8").splitlines():
        match = pattern.match(line)
        if not match:
            continue
        raw_path = match.group(1)
        color = match.group(2)
        decoded = urllib.parse.unquote(raw_path)
        if "/Notas/I.-Ciencia/" not in decoded:
            continue
        tail = decoded.split("/Notas/I.-Ciencia/", 1)[1].strip("/")
        if not tail:
            continue
        segments = tail.split("/")
        if len(segments) != 1:
            continue
        area_segment = segments[0]
        area_label = strip_number_prefix(area_segment).replace("-", " ").strip()
        area_key = normalize_label(area_label)
        if area_key and area_key not in colors:
            colors[area_key] = color
    return colors


def build_folder_tree(root: Path) -> FolderNode:
    def build(node_path: Path, parent_labels: Tuple[str, ...]) -> FolderNode:
        label = strip_number_prefix(node_path.name)
        path_labels = parent_labels + (label,)
        children = []
        for child in sorted(
            [p for p in node_path.iterdir() if p.is_dir() and not p.name.startswith(".")],
            key=lambda p: p.name.casefold(),
        ):
            children.append(build(child, path_labels))
        return FolderNode(
            label=label,
            norm_label=normalize_label(label),
            path_labels=path_labels,
            children=children,
        )

    top = FolderNode(label="I. Ciencia", norm_label="i ciencia", path_labels=tuple(), children=[])
    for child in sorted(
        [p for p in root.iterdir() if p.is_dir() and not p.name.startswith(".")],
        key=lambda p: p.name.casefold(),
    ):
        top.children.append(build(child, tuple()))
    return top


def flatten_descendants(node: FolderNode) -> List[FolderNode]:
    result = []
    stack = list(node.children)
    while stack:
        current = stack.pop(0)
        result.append(current)
        stack = current.children + stack
    return result


def best_match(
    target_norm: str,
    candidates: Iterable[FolderNode],
    aliases: Optional[Dict[str, str]] = None,
) -> Optional[FolderNode]:
    if not target_norm:
        return None
    alias_norm = aliases.get(target_norm, target_norm) if aliases else target_norm
    candidates = list(candidates)

    exact = [c for c in candidates if c.norm_label == alias_norm]
    if exact:
        return exact[0]

    starts = [
        c
        for c in candidates
        if c.norm_label.startswith(alias_norm) or alias_norm.startswith(c.norm_label)
    ]
    if starts:
        starts.sort(key=lambda n: (len(n.path_labels), abs(len(n.norm_label) - len(alias_norm))))
        return starts[0]

    target_tokens = set(alias_norm.split())
    token_matches = []
    for c in candidates:
        candidate_tokens = set(c.norm_label.split())
        if target_tokens and target_tokens.issubset(candidate_tokens):
            token_matches.append(c)
    if token_matches:
        token_matches.sort(key=lambda n: (len(n.path_labels), len(n.norm_label)))
        return token_matches[0]
    return None


def read_shared_strings(archive: zipfile.ZipFile) -> List[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    shared = []
    for si in root.findall("a:si", NS):
        direct = si.find("a:t", NS)
        if direct is not None:
            shared.append(direct.text or "")
        else:
            shared.append("".join((t.text or "") for t in si.findall(".//a:t", NS)))
    return shared


def read_cell_styles(archive: zipfile.ZipFile) -> Tuple[List[int], Dict[int, str]]:
    styles_root = ET.fromstring(archive.read("xl/styles.xml"))
    numfmts: Dict[int, str] = {}
    numfmts_root = styles_root.find("a:numFmts", NS)
    if numfmts_root is not None:
        for fmt in numfmts_root.findall("a:numFmt", NS):
            numfmts[int(fmt.attrib["numFmtId"])] = fmt.attrib.get("formatCode", "")

    xfs: List[int] = []
    cellxfs = styles_root.find("a:cellXfs", NS)
    if cellxfs is not None:
        for xf in cellxfs.findall("a:xf", NS):
            xfs.append(int(xf.attrib.get("numFmtId", "0")))
    return xfs, numfmts


def is_date_style(style_id: Optional[str], xfs: List[int], numfmts: Dict[int, str]) -> bool:
    if style_id is None:
        return False
    try:
        style_idx = int(style_id)
    except ValueError:
        return False
    numfmt_id = xfs[style_idx] if style_idx < len(xfs) else 0
    if numfmt_id in {14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47}:
        return True
    format_code = numfmts.get(numfmt_id, "").lower()
    return any(token in format_code for token in ("yy", "mm", "dd"))


def excel_serial_to_iso(serial: str) -> str:
    try:
        days = float(serial)
    except ValueError:
        return serial
    epoch = _dt.datetime(1899, 12, 30)
    value = (epoch + _dt.timedelta(days=days)).date()
    return value.isoformat()


def get_sheet_xml_path(archive: zipfile.ZipFile, sheet_name: str) -> str:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
    for sheet in workbook.find("a:sheets", NS).findall("a:sheet", NS):
        if sheet.attrib.get("name") != sheet_name:
            continue
        rel_id = sheet.attrib[f"{{{NS_REL}}}id"]
        target = rel_map[rel_id]
        if not target.startswith("xl/"):
            target = f"xl/{target}"
        return target
    raise ValueError(f"Sheet not found: {sheet_name}")


def read_sheet_rows(xlsx_path: Path, sheet_name: str) -> List[Dict[str, object]]:
    with zipfile.ZipFile(xlsx_path) as archive:
        sheet_path = get_sheet_xml_path(archive, sheet_name)
        shared = read_shared_strings(archive)
        xfs, numfmts = read_cell_styles(archive)
        sheet = ET.fromstring(archive.read(sheet_path))

        rows: List[Dict[str, object]] = []
        for row in sheet.findall(".//a:sheetData/a:row", NS):
            row_num = int(row.attrib.get("r", "0"))
            out: Dict[str, object] = {"_row": row_num}
            for cell in row.findall("a:c", NS):
                ref = cell.attrib.get("r", "")
                col = "".join(ch for ch in ref if ch.isalpha())
                data_type = cell.attrib.get("t")
                style = cell.attrib.get("s")
                value_node = cell.find("a:v", NS)

                if value_node is None:
                    inline = cell.find("a:is", NS)
                    if inline is not None:
                        out[col] = "".join((t.text or "") for t in inline.findall(".//a:t", NS))
                    else:
                        out[col] = ""
                    continue

                value = value_node.text or ""
                if data_type == "s":
                    try:
                        value = shared[int(value)]
                    except (ValueError, IndexError):
                        pass
                elif data_type is None and is_date_style(style, xfs, numfmts):
                    value = excel_serial_to_iso(value)
                out[col] = value
            rows.append(out)
        return rows


def as_text(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def parse_number(value) -> Optional[float]:
    raw = as_text(value)
    if not raw:
        return None
    raw = raw.replace(",", ".")
    try:
        num = float(raw)
    except ValueError:
        return None
    if num.is_integer():
        return int(num)
    return num


def parse_year(value) -> Optional[object]:
    raw = as_text(value)
    if not raw:
        return None
    num = parse_number(raw)
    if isinstance(num, int):
        return num
    return raw


def read_entries_from_rows(rows: List[Dict[str, object]]) -> List[Dict[str, object]]:
    context = {
        "area": "",
        "sub_area": "",
        "sub_sub_area": "",
        "author": "",
        "title": "",
    }
    entries: List[Dict[str, object]] = []

    for row in rows:
        row_num = int(row.get("_row", 0))
        if row_num < 3:
            continue

        area = as_text(row.get(COL_AREA))
        sub_area = as_text(row.get(COL_SUB_AREA))
        sub_sub_area = as_text(row.get(COL_SUB_SUB_AREA))
        author = as_text(row.get(COL_AUTHOR))
        title = as_text(row.get(COL_TITLE))
        chapter = as_text(row.get(COL_CHAPTER))

        if area:
            context["area"] = area
            context["sub_area"] = ""
            context["sub_sub_area"] = ""
            context["author"] = ""
            context["title"] = ""
        if sub_area:
            context["sub_area"] = sub_area
            context["sub_sub_area"] = ""
        if sub_sub_area:
            context["sub_sub_area"] = sub_sub_area
        if author:
            context["author"] = author
        if title:
            context["title"] = title

        effective_area = context["area"]
        effective_sub_area = context["sub_area"]
        effective_sub_sub_area = context["sub_sub_area"]
        effective_author = author or context["author"]
        effective_title = title or context["title"]

        year = parse_year(row.get(COL_YEAR))
        start = as_text(row.get(COL_START)) or None
        end = as_text(row.get(COL_END)) or None
        current = parse_number(row.get(COL_CURRENT))
        total = parse_number(row.get(COL_TOTAL))

        has_row_data = any(
            [
                title,
                chapter,
                year is not None,
                start is not None,
                end is not None,
                current is not None,
                total is not None,
            ]
        )

        if not effective_area or not has_row_data:
            continue

        is_book_row = bool(effective_title) and not bool(chapter)
        slug_seed = effective_title or chapter or effective_author or f"row-{row_num}"
        entry_id = f"r{row_num:04d}-{slugify(slug_seed)}"

        entries.append(
            {
                "id": entry_id,
                "row": row_num,
                "raw_area": effective_area,
                "raw_sub_area": effective_sub_area,
                "raw_sub_sub_area": effective_sub_sub_area,
                "author": effective_author or None,
                "title": effective_title or None,
                "chapter": chapter or None,
                "year": year,
                "start": start,
                "end": end,
                "current": current,
                "total": total,
                "is_book_row": bool(is_book_row),
                "sort_order": row_num,
            }
        )
    return entries


def resolve_entry_hierarchy(
    entry: Dict[str, object],
    tree: FolderNode,
) -> Dict[str, object]:
    top_aliases = {
        "linguas": "lenguas",
        "marxismo": "marxismo politica",
        "filosofia": "filosofia",
        "antropologia": "antropologia",
        "economia": "economia",
        "historia": "historia",
        "musica": "musica",
        "computer science": "computer science",
    }
    sub_aliases = {
        "engenharia": "audio engineering",
    }

    area_raw = as_text(entry.get("raw_area"))
    sub_raw = as_text(entry.get("raw_sub_area"))
    sub_sub_raw = as_text(entry.get("raw_sub_sub_area"))

    area_norm = normalize_label(area_raw)
    top = best_match(area_norm, tree.children, aliases=top_aliases)

    hierarchy_labels: List[str] = []
    hierarchy_sources: List[str] = []
    area_source = "custom"

    anchor: Optional[FolderNode] = None
    if top is not None:
        hierarchy_labels.append(top.label)
        hierarchy_sources.append("folder")
        area_source = "folder"
        anchor = top
    else:
        hierarchy_labels.append(area_raw)
        hierarchy_sources.append("custom")

    if sub_raw:
        mapped_sub = None
        if anchor is not None:
            mapped_sub = best_match(
                normalize_label(sub_raw),
                anchor.children,
                aliases=sub_aliases,
            )
            if mapped_sub is None:
                mapped_sub = best_match(
                    normalize_label(sub_raw),
                    flatten_descendants(anchor),
                    aliases=sub_aliases,
                )
        if mapped_sub is not None:
            for label in mapped_sub.path_labels[1:]:
                if label not in hierarchy_labels:
                    hierarchy_labels.append(label)
                    hierarchy_sources.append("folder")
            anchor = mapped_sub
        else:
            hierarchy_labels.append(sub_raw)
            hierarchy_sources.append("custom")
            anchor = None

    if sub_sub_raw:
        mapped_sub_sub = None
        search_root = anchor if anchor is not None else top
        if search_root is not None:
            mapped_sub_sub = best_match(
                normalize_label(sub_sub_raw),
                flatten_descendants(search_root),
            )
        if mapped_sub_sub is not None:
            start_idx = len(anchor.path_labels) if anchor is not None else 1
            for label in mapped_sub_sub.path_labels[start_idx:]:
                if label not in hierarchy_labels:
                    hierarchy_labels.append(label)
                    hierarchy_sources.append("folder")
        else:
            hierarchy_labels.append(sub_sub_raw)
            hierarchy_sources.append("custom")

    sub_labels = hierarchy_labels[1:]

    return {
        "area_label": hierarchy_labels[0],
        "area_source": area_source,
        "full_hierarchy_labels": hierarchy_labels,
        "hierarchy_sources": hierarchy_sources,
        "sub_labels": sub_labels,
        "subarea_path": " / ".join(sub_labels) if sub_labels else "",
    }


def next_fallback_color(index: int) -> str:
    return FALLBACK_COLORS[index % len(FALLBACK_COLORS)]


def build_categories_and_entries(
    raw_entries: List[Dict[str, object]],
    tree: FolderNode,
    graph_colors: Dict[str, str],
) -> Tuple[List[Dict[str, object]], List[Dict[str, object]]]:
    categories_by_path: Dict[Tuple[str, ...], Dict[str, object]] = {}
    category_order = 0
    custom_area_count = 0
    area_colors: Dict[str, str] = {}

    entries: List[Dict[str, object]] = []

    for raw in raw_entries:
        resolved = resolve_entry_hierarchy(raw, tree)
        area_label = resolved["area_label"]
        area_norm = normalize_label(area_label)

        if area_norm not in area_colors:
            if resolved["area_source"] == "folder" and area_norm in graph_colors:
                area_colors[area_norm] = graph_colors[area_norm]
            else:
                area_colors[area_norm] = next_fallback_color(custom_area_count)
                custom_area_count += 1
        area_color = area_colors[area_norm]

        labels: List[str] = resolved["full_hierarchy_labels"]
        sources: List[str] = resolved["hierarchy_sources"]

        parent_path: Tuple[str, ...] = tuple()
        for idx, label in enumerate(labels):
            current_path = tuple(labels[: idx + 1])
            if current_path not in categories_by_path:
                cat_id = slugify("--".join(current_path))
                categories_by_path[current_path] = {
                    "id": cat_id,
                    "label": label,
                    "hierarchy": " / ".join(current_path),
                    "parent_id": categories_by_path[parent_path]["id"] if parent_path else None,
                    "source": sources[idx],
                    "color": area_color,
                    "sort_order": category_order,
                }
                category_order += 1
            parent_path = current_path

        area_id = categories_by_path[(labels[0],)]["id"]
        entry = {
            "id": raw["id"],
            "area_id": area_id,
            "subarea_path": resolved["subarea_path"],
            "author": raw["author"],
            "title": raw["title"],
            "chapter": raw["chapter"],
            "year": raw["year"],
            "start": raw["start"],
            "end": raw["end"],
            "current": raw["current"],
            "total": raw["total"],
            "is_book_row": raw["is_book_row"],
            "sort_order": raw["sort_order"],
        }
        entries.append(entry)

    categories = sorted(categories_by_path.values(), key=lambda x: x["sort_order"])
    entries.sort(key=lambda x: x["sort_order"])
    return categories, entries


def render_reading_tracker_yaml(
    categories: List[Dict[str, object]],
    entries: List[Dict[str, object]],
) -> str:
    lines: List[str] = []
    lines.append("categories:")
    for cat in categories:
        lines.append("  - id: " + yaml_scalar(cat["id"]))
        lines.append("    label: " + yaml_scalar(cat["label"]))
        lines.append("    hierarchy: " + yaml_scalar(cat["hierarchy"]))
        lines.append("    parent_id: " + yaml_scalar(cat["parent_id"]))
        lines.append("    source: " + yaml_scalar(cat["source"]))
        lines.append("    color: " + yaml_scalar(cat["color"]))
        lines.append("    sort_order: " + yaml_scalar(cat["sort_order"]))

    lines.append("entries:")
    for entry in entries:
        lines.append("  - id: " + yaml_scalar(entry["id"]))
        lines.append("    area_id: " + yaml_scalar(entry["area_id"]))
        lines.append("    subarea_path: " + yaml_scalar(entry["subarea_path"]))
        lines.append("    author: " + yaml_scalar(entry["author"]))
        lines.append("    title: " + yaml_scalar(entry["title"]))
        lines.append("    chapter: " + yaml_scalar(entry["chapter"]))
        lines.append("    year: " + yaml_scalar(entry["year"]))
        lines.append("    start: " + yaml_scalar(entry["start"]))
        lines.append("    end: " + yaml_scalar(entry["end"]))
        lines.append("    current: " + yaml_scalar(entry["current"]))
        lines.append("    total: " + yaml_scalar(entry["total"]))
        lines.append("    is_book_row: " + yaml_scalar(entry["is_book_row"]))
        lines.append("    sort_order: " + yaml_scalar(entry["sort_order"]))

    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Import reading tracker spreadsheet.")
    parser.add_argument("--xlsx", type=Path, default=DEFAULT_XLSX)
    parser.add_argument("--sheet", default="Livros")
    parser.add_argument("--i-ciencia-root", type=Path, default=DEFAULT_I_CIENCIA_ROOT)
    parser.add_argument("--graph-config", type=Path, default=DEFAULT_GRAPH_CONFIG)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    rows = read_sheet_rows(args.xlsx, args.sheet)
    raw_entries = read_entries_from_rows(rows)
    tree = build_folder_tree(args.i_ciencia_root)
    graph_colors = parse_graph_area_colors(args.graph_config)
    categories, entries = build_categories_and_entries(raw_entries, tree, graph_colors)
    yaml_text = render_reading_tracker_yaml(categories, entries)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(yaml_text, encoding="utf-8")
    print(f"Wrote {len(categories)} categories and {len(entries)} entries to {args.output}")


if __name__ == "__main__":
    main()
