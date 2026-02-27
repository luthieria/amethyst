---
title: "Advanced Tables Demo"
date: 2026-02-24
bookToC: false
---

# Advanced Tables Demonstration

This page demonstrates the usage of the new advanced table shortcodes that support merging cells and premium "Excel-like" styling.

## 1. Merged Headers (Colspan)

{{< table >}}
  {{< tr >}}
    {{< th colspan="2" >}}Instrument Group{{< /th >}}
    {{< th >}}Details{{< /th >}}
  {{< /tr >}}
  {{< tr >}}
    {{< td >}}String{{< /td >}}
    {{< td >}}Guitar{{< /td >}}
    {{< td >}}Acoustic or Electric{{< /td >}}
  {{< /tr >}}
  {{< tr >}}
    {{< td >}}String{{< /td >}}
    {{< td >}}Violin{{< /td >}}
    {{< td >}}Classical only{{< /td >}}
  {{< /tr >}}
{{< /table >}}

---

## 2. Merged Rows (Rowspan)

{{< table theme="excel-theme" >}}
  {{< tr >}}
    {{< th >}}Category{{< /th >}}
    {{< th >}}Item{{< /th >}}
    {{< th >}}Value{{< /th >}}
  {{< /tr >}}
  {{< tr >}}
    {{< td rowspan="3" align="center" >}}**Hardware**{{< /td >}}
    {{< td >}}Processor{{< /td >}}
    {{< td >}}i9{{< /td >}}
  {{< /tr >}}
  {{< tr >}}
    {{< td >}}RAM{{< /td >}}
    {{< td >}}64GB{{< /td >}}
  {{< /tr >}}
  {{< tr >}}
    {{< td >}}Storage{{< /td >}}
    {{< td >}}2TB NVMe{{< /td >}}
  {{< /tr >}}
{{< /table >}}

---

## 3. Complex Grid (Rowspan + Colspan)

{{< table >}}
  {{< tr >}}
    {{< th rowspan="2" >}}Service{{< /th >}}
    {{< th colspan="2" >}}Pricing Tier{{< /th >}}
  {{< /tr >}}
  {{< tr >}}
    {{< th >}}Basic{{< /th >}}
    {{< th >}}Pro{{< /th >}}
  {{< /tr >}}
  {{< tr >}}
    {{< td >}}Web Hosting{{< /td >}}
    {{< td >}}$5/mo{{< /td >}}
    {{< td >}}$15/mo{{< /td >}}
  {{< /tr >}}
  {{< tr >}}
    {{< td >}}Support{{< /td >}}
    {{< td colspan="2" align="center" >}}**Included in all plans**{{< /td >}}
  {{< /tr >}}
{{< /table >}}

---

## 4. Interactive Spreadsheet (Handsontable)

This table is interactive! You can sort, filter, and resize columns.

{{< handsontable height="300px" >}}
ID, Product, Price, Stock
1, Acoustic Guitar, 450, 12
2, Electric Guitar, 800, 5
3, Violin, 600, 8
4, Piano, 2500, 2
5, Flute, 150, 20
{{< /handsontable >}}