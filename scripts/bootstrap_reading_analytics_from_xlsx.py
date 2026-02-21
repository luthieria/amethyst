#!/usr/bin/env python3
"""Bootstrap reading analytics seed data from XLSX.

Usage:
  python scripts/bootstrap_reading_analytics_from_xlsx.py
  python scripts/bootstrap_reading_analytics_from_xlsx.py --upload --replace
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib import error as urlerror
from urllib import parse as urlparse
from urllib import request as urlrequest
import xml.etree.ElementTree as ET
import zipfile


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
DEFAULT_SHEET = "Livros"
DEFAULT_OUTPUT = Path("data/reading_analytics_seed.json")
DEFAULT_BATCH_SIZE = 200


def read_shared_strings(archive: zipfile.ZipFile) -> List[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    shared: List[str] = []
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
    date_value = (epoch + _dt.timedelta(days=days)).date()
    return date_value.isoformat()


def get_sheet_xml_path(archive: zipfile.ZipFile, sheet_name: str) -> str:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
    sheets = workbook.find("a:sheets", NS)
    if sheets is None:
        raise ValueError("Workbook does not contain sheet definitions.")
    for sheet in sheets.findall("a:sheet", NS):
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
            out: Dict[str, object] = {"_row": int(row.attrib.get("r", "0"))}
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


def as_text(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def parse_number(value: object) -> Optional[float]:
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


def parse_year(value: object) -> Optional[int]:
    num = parse_number(value)
    if isinstance(num, int):
        return num
    return None


def normalize_date(value: object) -> Optional[str]:
    text = as_text(value)
    if not text:
        return None
    if len(text) == 10 and text[4] == "-" and text[7] == "-":
        return text
    try:
        parsed = _dt.datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed.date().isoformat()


def build_seed_entries(rows: List[Dict[str, object]]) -> List[Dict[str, object]]:
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

        effective_title = title or context["title"]
        effective_author = author or context["author"] or None

        year_published = parse_year(row.get(COL_YEAR))
        start_date = normalize_date(row.get(COL_START))
        finish_date = normalize_date(row.get(COL_END))
        pages_read = parse_number(row.get(COL_CURRENT))
        pages = parse_number(row.get(COL_TOTAL))

        has_data = any(
            [
                effective_title,
                chapter,
                year_published is not None,
                start_date is not None,
                finish_date is not None,
                pages_read is not None,
                pages is not None,
            ]
        )
        if not has_data or not effective_title:
            continue

        genre_parts = [
            context["area"],
            context["sub_area"],
            context["sub_sub_area"],
        ]
        genre = " / ".join(part for part in genre_parts if part) or None
        notes = f"Chapter: {chapter}" if chapter else None

        entries.append(
            {
                "title": effective_title,
                "author": effective_author,
                "year_published": year_published,
                "pages": int(pages) if isinstance(pages, int) else None,
                "pages_read": int(pages_read) if isinstance(pages_read, int) else None,
                "start_date": start_date,
                "finish_date": finish_date,
                "genre": genre,
                "language": None,
                "format": None,
                "rating": None,
                "notes": notes,
                "reread": False,
                "abandoned": False,
            }
        )

    return entries


def write_seed_json(entries: List[Dict[str, object]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def http_json_request(
    method: str,
    url: str,
    payload: Optional[object],
    supabase_key: str,
) -> Tuple[int, str]:
    data = None
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
    }
    if method == "POST":
        headers["Prefer"] = "return=minimal"
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    req = urlrequest.Request(url, method=method, data=data, headers=headers)
    try:
        with urlrequest.urlopen(req) as response:
            body = response.read().decode("utf-8", errors="replace")
            return response.status, body
    except urlerror.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} failed: HTTP {exc.code} {body}") from exc


def upload_entries(
    supabase_url: str,
    service_role_key: str,
    owner_user_id: str,
    entries: List[Dict[str, object]],
    replace: bool,
    batch_size: int,
) -> None:
    base = supabase_url.rstrip("/")
    endpoint = f"{base}/rest/v1/reading_entries"

    if replace:
        owner_q = urlparse.quote(owner_user_id, safe="")
        delete_url = f"{endpoint}?owner_user_id=eq.{owner_q}"
        http_json_request("DELETE", delete_url, None, service_role_key)

    payload = []
    for entry in entries:
        row = dict(entry)
        row["owner_user_id"] = owner_user_id
        payload.append(row)

    for idx in range(0, len(payload), batch_size):
        chunk = payload[idx : idx + batch_size]
        http_json_request("POST", endpoint, chunk, service_role_key)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bootstrap reading analytics seed data from XLSX.")
    parser.add_argument("--xlsx", type=Path, default=DEFAULT_XLSX)
    parser.add_argument("--sheet", default=DEFAULT_SHEET)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--upload", action="store_true")
    parser.add_argument("--replace", action="store_true")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--supabase-url", default=os.getenv("SUPABASE_URL", ""))
    parser.add_argument("--service-role-key", default=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""))
    parser.add_argument("--owner-user-id", default=os.getenv("READING_ANALYTICS_OWNER_USER_ID", ""))
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if not args.xlsx.exists():
        raise FileNotFoundError(f"XLSX file not found: {args.xlsx}")

    rows = read_sheet_rows(args.xlsx, args.sheet)
    entries = build_seed_entries(rows)
    write_seed_json(entries, args.output)
    print(f"Wrote {len(entries)} entries to {args.output}")

    if not args.upload:
        return

    if not args.supabase_url:
        raise ValueError("Missing Supabase URL. Set --supabase-url or SUPABASE_URL.")
    if not args.service_role_key:
        raise ValueError("Missing service role key. Set --service-role-key or SUPABASE_SERVICE_ROLE_KEY.")
    if not args.owner_user_id:
        raise ValueError("Missing owner user id. Set --owner-user-id or READING_ANALYTICS_OWNER_USER_ID.")
    if args.batch_size <= 0:
        raise ValueError("--batch-size must be > 0.")

    upload_entries(
        supabase_url=args.supabase_url,
        service_role_key=args.service_role_key,
        owner_user_id=args.owner_user_id,
        entries=entries,
        replace=args.replace,
        batch_size=args.batch_size,
    )
    print(f"Uploaded {len(entries)} entries to Supabase.")


if __name__ == "__main__":
    main()
