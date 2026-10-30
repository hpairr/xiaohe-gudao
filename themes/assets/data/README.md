# 女书字表数据

`unicode_nushu.csv` 是「女书专题页 · 展开的女书字典」使用的原始字表。

## 来源

- 在线女书字典：<https://nushuscript.org/>（Nushu Developers Workgroup）
- 字表数据：<https://github.com/nushu-script/unicode_nushu> 的 `data.csv`
- 下载日期：2026-10-28
- 字帖依据：赵丽明、徐焰编纂《女书规范字书法字帖》（Unicode 标准）

## 列

| 列 | 说明 |
| --- | --- |
| 女书字符 | Unicode 女书区（U+1B170–U+1B2FF）中的标准字形 |
| 《字帖》序 | 0–395，对应字帖顺序；页面上的「094 / 396」即此序 + 1 |
| 对应汉字 | 该女书字可记写的汉字（表音文字，一形可对应多个同音汉字） |
| 江永方言代表发音 | 拉丁转写 + 调值，如 `njyu13`；数字为 5 度制调值 |

原始表共 396 个女书字、1760 个汉字。

## 本页的编辑层

页面从 396 字中取 **144 字**，每个女书字形只出现一次。

- 取字、取义（`focus`）与一句释义（`gloss`）在
  `themes/scripts/build_nushu_dict.py` 中维护；改完重新运行：

  ```bash
  python themes/scripts/build_nushu_dict.py
  ```

- 生成 `themes/assets/nushu-dict.js` 与 144 字字体子集
  `themes/assets/NotoSansNushu-Dict.woff2`。

「对应汉字」与「江永方言代表发音」保持原始数据不变；`focus` / `gloss`
是本站编辑文字，不作为字典原文引用。

## 字形与授权

- 字形：Noto Sans Nüshu（SIL Open Font License），由
  `xiaohe-gudao-db/assets/fonts/NotoSansNushu-Regular.ttf` 子集化而来。
- 数据用于本毕设的非商业文化展示；引用请回到上述来源。
