# -*- coding: utf-8 -*-
"""
六个主题专题页生成器
====================
一份版式 + 六份内容 → 六个自包含 HTML。
这样做的理由：六页必须「看着像一个家族」（同一套版式与配色令牌），
但文案、纹样、图注又各不相同；用生成器能保证版式改动一次到位，不会六页走样。

用法：
    python gen_themes.py
产物：
    themes/02-女书.html … themes/07-富川织锦.html（六章专题页，统一由本脚本生成；
    潇贺古道 / 上灯炸龙为归档页，不在此脚本重写）

版式：Chromatic Field —— 一整屏主题色、可切换纹样工作台、现场图版、
      声纹条与六章色带；正文保留事实与出处，但不再做白色文档页。
      资料来源不折叠，作为常驻核对表排在整页最下面（页脚之后），
      机构名与网址做成外链；没有公开网页的文献保持纯文字。

依据：
    · 版式与配色  docs/06-技术方案/06-主页纹样与主题页设计说明.md
    · 逐主题数据  A毕设图形/10-主题视觉转化研究报告.md（每条都带出处）
    · 素材目录    images/视觉转化素材库/NN-主题/
"""

# 注意（2026-10-31）：当前 themes/02–07 已有手工增补，直接重跑会覆盖；
# 重跑前先备份，或只改本文件的 CHAPTERS / page_* 名称与颜色。

import io
import os
import re
from html import unescape
from urllib.parse import quote

HERE = os.path.dirname(os.path.abspath(__file__))

# 站点根地址。换仓库名时：先跑 tools/set-site-url.mjs，再改这里这一处，然后重新生成本文件。
SITE = "https://hpairr.github.io/xiaohe-gudao/"

# ---------------------------------------------------------------- 公共部件

CHAPTERS = [
    dict(href="02-女书.html", no="壹", num="01", cn="女书", en="Nüshu", key="nushu",
         color="#1D2652", fg="#F2EDE2", surface="#0B1028", place="湖南 · 江永"),
    dict(href="03-蝴蝶歌.html", no="贰", num="02", cn="蝴蝶歌", en="Butterfly Song", key="butterfly",
         color="#B8862F", fg="#141A16", surface="#E8C982", place="广西 · 富川"),
    dict(href="04-长鼓舞.html", no="叁", num="03", cn="长鼓舞", en="Long Drum Dance", key="drum",
         color="#A9362E", fg="#F2EDE2", surface="#661E19", place="湘桂 · 瑶族地区"),
    dict(href="05-风雨桥.html", no="肆", num="04", cn="富川风雨桥", en="Wind-Rain Bridge", key="bridge",
         color="#4C6C8B", fg="#F2EDE2", surface="#193854", place="广西 · 富川"),
    dict(href="06-盘王大歌.html", no="伍", num="05", cn="盘王大歌", en="Panwang Da Ge", key="panwang",
         color="#15120F", fg="#F2EDE2", surface="#070504", place="湖南 · 江华"),
    dict(href="07-富川织锦.html", no="陆", num="06", cn="瑶族织锦", en="Yao Brocade", key="brocade",
         color="#5E3F55", fg="#F2EDE2", surface="#2E1F2A", place="广西 · 富川"),
]

# 每章的视觉转译说明：不是新增史料，而是解释本章界面为什么这样构成。
THEME_NOTES = {
    "nushu": dict(
        tagline="长菱形字格 · 点 / 竖 / 斜 / 弧",
        lab_title="把长菱形字格，拆成一套会呼吸的图形系统。",
        lab_copy="外框是八角连弧，内芯随题材替换；字格提供节奏，点、竖、斜、弧构成最小笔画单位。"
                 "工作台把它拆成骨架、单元与连续三种读法。",
        spec=[("01", "字格", "长菱形 · 左低右高"), ("02", "笔画", "点 / 竖 / 斜 / 弧"),
              ("03", "纹样", "八角连弧 · 内芯可变")],
        field_title="纸上的字，墙上的字",
        field_copy="手稿、博物馆展墙与女书墙，让同一套字形在不同尺度里被重新观看。"),
    "butterfly": dict(
        tagline="二声部 · 同起同收 · 大二度 → 同度",
        lab_title="让两条声部线，在同一个呼吸里合拢。",
        lab_copy="同起同收、大小三度为骨，长时值大二度解决到同度。界面把两条旋律线转成一组会合拢的双线，"
                 "并用留白控制呼吸。",
        spec=[("01", "声部", "2 / 双线并行"), ("02", "关系", "同起同收"),
              ("03", "转折", "大二度 → 同度")],
        field_title="歌会、舞台与村口",
        field_copy="从传承人群合影到演出现场，蝴蝶歌始终是一种由两个人共同完成的现场。"),
    "drum": dict(
        tagline="细腰鼓身 · 七十二套动作 · 曲身拧转",
        lab_title="把鼓点的强弱，写成可以旋转的同心节奏。",
        lab_copy="鼓身细长、中腰收束，动作以围圈与转身展开。界面把鼓面、束腰和舞步压成同心圆与径向线，"
                 "滚动时像一次缓慢的击鼓。",
        spec=[("01", "鼓身", "细长 · 中腰束腰"), ("02", "动作", "据载 72 套"),
              ("03", "姿态", "曲身拧转")],
        field_title="从高台到圆场",
        field_copy="连南的围圈、富川的高台与舞台演出，让长鼓舞的身体在不同场地里形成不同半径。"),
    "bridge": dict(
        tagline="三孔石拱 · 廊 / 亭 / 阁 · 水纹",
        lab_title="从拱、廊、亭、阁，抽出可叠合的秩序。",
        lab_copy="三孔石拱、桥廊、桥亭与阁楼在立面上层层叠合。界面以拱线、檐线与水纹三层重构这种剖面关系，"
                 "桥不只是被介绍的对象，也是版式的结构。",
        spec=[("01", "桥体", "三孔石拱"), ("02", "构造", "廊 / 亭 / 阁"),
              ("03", "群数", "现存 27 座")],
        field_title="桥在溪上，也在村落之间",
        field_copy="回澜、青龙与富川桥群：桥体、廊屋和水面共同构成一处可以停留的公共空间。"),
    "panwang": dict(
        tagline="方印 · 八角 · 歌行 · 七任曲",
        lab_title="把方印、八角与歌行，压成一枚当代章节印记。",
        lab_copy="方印、八角、竖行歌本与七任曲，是本章四个视觉锚点。界面把歌行变成可滚动的文本织体，"
                 "把「唱」转译成节拍与留白。",
        spec=[("01", "歌本", "约 8000 行"), ("02", "曲牌", "七任曲"),
              ("03", "版本", "36 / 24 / 12 段")],
        field_title="抄本、祭场与歌本",
        field_copy="盘王印、江永盘王节与祭祀现场：史诗不只存在于字里，也存在于仪式与声音里。"),
    "brocade": dict(
        tagline="经纬显花 · 二方 / 四方连续 · 五色",
        lab_title="把经纬、重复与色彩，织成可滚动的纹样界面。",
        lab_copy="二方连续、四方连续，与对称、中心、围合、套嵌的构图，构成可复用的织纹语法。"
                 "页面把经纬线、显花单元与色带做成可以切换的图形系统。",
        spec=[("01", "显花", "经纬显花"), ("02", "构图", "对称 / 中心 / 围合 / 套嵌"),
              ("03", "组织", "二方 / 四方连续")],
        field_title="衣物、被面与织机",
        field_copy="服饰、万字纹被面与织机，把纹样放回它被使用、被触摸的材料现场。"),
}

# 现场图版：生成时直接写入 HTML，图片不依赖 JS 才出现。
GALLERY = {
    "nushu": [
        dict(src="../assets/img/nushu.jpg", w=1100, h=826, caption="女书手稿", source="本站资料图",
             alt="江永女书手稿，竖行墨书女书字符与汉字对照"),
        dict(src="../images/主题图版/女书-博物馆.jpg", w=1000, h=667, caption="江永女书生态博物馆",
             source="永州政府网 · CICPHOTO", alt="江永女书生态博物馆内，讲解员向观众介绍女书卷轴"),
        dict(src="../images/主题图版/女书-墙.jpg", w=1000, h=667, caption="女书墙",
             source="永州政府网 · CICPHOTO", alt="江永女书墙，白底墨书女书字符"),
    ],
    "butterfly": [
        dict(src="../assets/img/butterfly.jpg", w=550, h=366, caption="蝴蝶歌传承人群", source="本站资料图",
             alt="富川瑶族蝴蝶歌传承人群合影"),
        dict(src="../images/主题图版/蝴蝶歌-演出现场.jpg", w=1600, h=897, caption="富川演出现场",
             source="贺州新闻网", alt="富川瑶族蝴蝶歌演出现场，歌手穿蓝色瑶族服饰"),
        dict(src="../images/主题图版/蝴蝶歌-秀水村.jpg", w=1500, h=843, caption="秀水村合唱",
             source="新浪财经", alt="秀水村牌楼前，瑶族群众合唱蝴蝶歌"),
    ],
    "drum": [
        dict(src="../assets/img/drum.jpg", w=1200, h=828, caption="瑶族长鼓舞", source="本站资料图",
             alt="瑶族长鼓舞表演，舞者手持长鼓腾跃"),
        dict(src="../images/主题图版/长鼓舞-连南.jpg", w=1600, h=1200, caption="连南瑶寨展演",
             source="南方+", alt="连南瑶寨长鼓舞展演，舞者围圈击鼓"),
        dict(src="../images/主题图版/长鼓舞-舞台.jpg", w=1600, h=1200, caption="长鼓舞舞台",
             source="南方+", alt="长鼓舞舞台演出，演员在圆形舞台上击鼓"),
    ],
    "bridge": [
        dict(src="../assets/img/bridge.jpg", w=1100, h=774, caption="富川风雨桥", source="本站资料图",
             alt="富川瑶族风雨桥，三孔石拱上架桥廊与桥亭"),
        dict(src="../images/主题图版/风雨桥-回澜.jpg", w=1080, h=640, caption="回澜 · 青龙风雨桥",
             source="百度百科", alt="富川回澜风雨桥与青龙风雨桥"),
        dict(src="../images/主题图版/风雨桥-群桥.jpg", w=1600, h=1089, caption="富川风雨桥群",
             source="百度百科", alt="富川瑶族风雨桥群，多座桥廊沿溪而建"),
    ],
    "panwang": [
        dict(src="../assets/img/panwang.jpg", w=810, h=810, caption="盘王印", source="本站资料图",
             alt="盘王印方形绣片，红底几何纹"),
        dict(src="../images/主题图版/盘王-江永.jpg", w=1600, h=1065, caption="江永盘王节",
             source="搜狐 · 江永", alt="江永瑶族盘王节祭祀典礼，盘王雕像前的人群"),
        dict(src="../images/主题图版/盘王-祭祀.jpg", w=1600, h=1067, caption="盘王节祭祀",
             source="永州政府网", alt="江永盘王节祭祀表演，红毯与盘王像"),
    ],
    "brocade": [
        dict(src="../assets/img/brocade.jpg", w=640, h=465, caption="瑶族服饰", source="本站资料图",
             alt="富川瑶族传统服饰，妇女在门前合影"),
        dict(src="../images/主题图版/织锦-万字纹.jpg", w=1600, h=1067, caption="万字纹被面",
             source="百度百科", alt="富川瑶族织锦万字纹被面，几何纹样"),
        dict(src="../images/主题图版/织锦-织机.jpg", w=1080, h=608, caption="织锦技艺",
             source="新浪", alt="瑶族妇女在织机前织锦"),
    ],
}


def nav():
    return """<nav class="top-nav" id="themeNav" aria-label="主导航">
  <a class="back" href="../index.html#index"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 8H3M7 3L2 8l5 5"/></svg>返回六章</a>
  <a class="site" href="../index.html">潇贺古道有声文化数据库</a>
  <div class="nav-links">
    <a href="../index.html">首页</a>
    <a href="../database.html#/archive">文化档案</a>
    <a href="../database.html#/sounds">声音数据库</a>
    <a href="../database.html#/atlas">古道图志</a>
    <a href="../index.html#index">六章</a>
    <a href="../database.html#/about">关于与来源</a>
  </div>
</nav>"""


def hero(m, ratio_note, no=""):
    """整屏主题色场：巨字 + 可驱动的纹样 + 一段可读导语。"""
    chapter = next(c for c in CHAPTERS if c["key"] == m["key"])
    notes = THEME_NOTES[m["key"]]
    badges = "".join(
        '<span class="badge%s">%s</span>' % (" hot" if i == 0 else "", b)
        for i, b in enumerate(m["badges"]))
    title_class = "hero-title hero-title--long" if len(m["cn"]) >= 4 else "hero-title"
    return """<header class="theme-hero" data-theme-key="%(key)s">
  <div class="wrap hero-layout">
    <div class="hero-copy">
      <div class="hero-chapter"><span>CHAPTER %(no)s / 06</span><span>%(en_upper)s</span></div>
      <h1 class="%(title_class)s" id="themeTitle">%(cn)s</h1>
      <div class="hero-en">%(en)s</div>
      <p class="hero-lead">%(lead)s</p>
      <div class="hero-badges">%(badges)s</div>
    </div>
    <div class="hero-art">
      <div class="motif-unit" data-motif-unit aria-hidden="true"></div>
      <span class="hero-art-caption">VISUAL TRANSLATION / 非传统纹样复原</span>
    </div>
  </div>
  <div class="wrap hero-footer">
    <span>%(tagline)s</span>
    <span class="hero-coord">%(place)s · %(no)s / 06</span>
    <span class="hero-place">SCROLL / 继续向下 <span class="scroll-note" aria-hidden="true"></span></span>
  </div>
</header>""" % dict(
        key=m["key"], no=chapter["num"],
        en_upper=m["en"].upper(), cn=m["cn"], en=m["en"], lead=m["lead"],
        badges=badges, title_class=title_class, tagline=notes["tagline"], place=chapter["place"])


def sec(no, cn, en, body, note=""):
    """正文是「色场里的版面」，不是白色文档页。

    资料来源不再折叠：正文里只留一个标记，由 source_ledger() 统一排到整页最下面，
    常驻可见，不设展开/收起开关。
    """
    if cn == "资料来源":
        return SOURCE_MARK + body + (SOURCE_NOTE + note if note else "")
    return """<section class="story-block" data-step="%(no)s" id="story-%(no)s">
  <div class="wrap">
    <div class="story-grid">
      <aside class="story-rail" aria-hidden="true">
        <span class="story-no">%(no)s</span>
        <span class="story-en">%(en)s</span>
        <i></i>
      </aside>
      <div class="story-main">
        <div class="story-head"><h2>%(cn)s</h2><span class="en-tag">%(en)s</span></div>
        <div class="story-body">%(body)s</div>
      </div>
    </div>
  </div>
</section>""" % dict(no=no, cn=cn, en=en, body=body)


SOURCE_MARK = "<!--SOURCES-->"
SOURCE_NOTE = "<!--SOURCE-NOTE-->"


def source_ledger(raw):
    """整页最下面的资料来源核对表：常驻显示，没有折叠开关。"""
    if not raw.startswith(SOURCE_MARK):
        return ""
    raw = raw[len(SOURCE_MARK):]
    body, _, note = raw.partition(SOURCE_NOTE)
    rows = re.findall(r"<tr>.*?</tr>", body, re.S)
    if not rows:
        return ""
    head = rows[0].replace("<th>", '<th scope="col">').strip()
    data = rows[1:]
    rows_html = "\n".join("          " + r.strip() for r in data)
    note_html = '\n      <p class="ledger-fine">%s</p>' % note.strip() if note else ""
    return """<section class="source-ledger" id="sources" aria-labelledby="sourceTitle">
  <div class="wrap ledger-grid">
    <div class="ledger-head">
      <p class="eyebrow"><i></i>SOURCES / 出处</p>
      <h2 id="sourceTitle">资料来源</h2>
      <p class="ledger-note">本页每条事实的出处，逐条列出，可随时核对。完整来源说明见 <a href="../database.html#/about">「关于与来源」</a>。</p>
      <div class="ledger-meta">
        <span>04 / Sources · %(count)d 条</span>
        <a class="ledger-back" href="#main">回到页首 <span aria-hidden="true">↑</span></a>
      </div>
    </div>
    <div class="ledger-body">
      <table class="src" aria-labelledby="sourceTitle">
        <thead>
          %(head)s
        </thead>
        <tbody>
%(rows)s
        </tbody>
      </table>%(note)s
    </div>
  </div>
</section>""" % dict(count=len(data), head=head, rows=rows_html, note=note_html)


def facts(items):
    return '<ul class="facts">%s</ul>' % "".join(
        '<li>%s <span class="src">%s</span></li>' % (t, s) for t, s in items)


def files_figs(topic):
    """正文不再列素材目录里的文件清单；参考图统一放在页末来源里说明。"""
    return ''


def figs(items):
    return '<div class="figrow">%s</div>' % "".join(
        '<div class="fig"><div class="n">%s</div><div class="l">%s</div><div class="s">%s</div></div>'
        % (n, l, s) for n, l, s in items)


def cards(items):
    return '<div class="grid3">%s</div>' % "".join(
        '<div class="card"><h3>%s</h3><p>%s</p></div>' % (h, p) for h, p in items)


def steps(items):
    """构造过程四格：每格一枚「只有外框」的小八角花 + 序号，纹样本体由 JS 注入"""
    return '<div class="steps">%s</div>' % "".join(
        '<figure class="step"><span class="step-slot"></span><figcaption><b>%s</b>%s</figcaption></figure>'
        % (b, c) for (b, c) in items)


def variants(items):
    return '<div class="variants">%s</div>' % "".join(
        '<div class="variant"><span class="var-slot"></span><span>%s</span></div>' % c
        for c in items)


# ---------------------------------------------------------------- 来源外链
#
# 来源表里的机构名与网址做成外链；链接取自
# A毕设图形/10-主题视觉转化研究报告.md 与 docs/参考链接。
# 没有公开网页的纯文献引用（论文集、期刊、公开资料整理）保持文字，不硬指到首页。

SOURCE_LINK_TOKENS = {
    "《女书文化：织锦、刺绣、八角花篇》":
        "https://www.sohu.com/a/218107329_488835",
    "《女书与「八角花」图案》":
        "https://www.cnki.com.cn/Article/CJFDTotal-YSTS200901036.htm",
    "《女书「三朝书」探析》":
        "https://wap.cnki.net/touch/web/Journal/Article/MZYS201303027.html",
    "《黄河之声》":
        "https://www.cnki.com.cn/Article/CJFDTOTAL-HHZS202214002.htm",
    "搜狐《探索神秘的瑶族长鼓》":
        "https://www.sohu.com/a/360026096_120493167",
    "袁兴《广西贺州瑶族服饰文化传承中的形态及设计转化》(2023)":
        "https://www.ihchina.cn/art/detail/id/27194.html",
    "袁兴 2023":
        "https://www.ihchina.cn/art/detail/id/27194.html",
    "广西壮族自治区文化和旅游厅官网":
        "http://wlt.gxzf.gov.cn/gddt/t27799838.shtml",
    "富川瑶族自治县人民政府官网":
        "http://www.gxfc.gov.cn/fcgk/jdjj/t10824361.shtml",
    "富川瑶族自治县文旅局":
        "http://fclv.tourage.cn/news/detail-270.html",
    "富川县政府官网":
        "http://www.gxfc.gov.cn/fcgk/jdjj/t10824361.shtml",
    "江华瑶族自治县人民政府":
        "http://www.jh.gov.cn/jh/yzwh/202206/101c4ae631474ab9a86f74d8afa0762c.shtml",
    "湖南省文化和旅游厅":
        "http://whhlyt.hunan.gov.cn/news/tpxw/201909/t20190910_5482779.html",
    "永州市人民政府网":
        "https://www.yzcity.gov.cn/wlgtj/0202/201704/26dab8a53f654a24b1e459ceab8498c7.shtml",
    "广西纪检监察网":
        "https://www.gxjjw.gov.cn/staticpages/20211220/gxjjw61c05457-166041.shtml",
    "中国非物质文化遗产网":
        "https://www.ihchina.cn/",
    "福建省文物局":
        "http://wwj.wlt.fujian.gov.cn/xwzx/wbyw/202410/t20241021_6550891.htm",
    "人民网广西":
        "http://gx.people.com.cn/n2/2023/0607/c179435-40447424.html",
    "文化和旅游部":
        "https://zhuanti.mct.gov.cn/xcss2024_xcygj/guangxi/detail/7172.html",
    "广西日报":
        "https://epaper.gxrb.com.cn/gxrb2/html/2023-01/11/content_1903893.htm",
    "国际在线":
        "https://big5.cri.cn/gate/big5/gx.cri.cn/2023-01-11/586816ce-4d6c-b326-c231-354012c8b272.html",
    "搜狐文化":
        "https://cul.sohu.com/a/908964294_119038",
    "知网空间":
        "https://www.cnki.com.cn/",
    "万方":
        "https://www.wanfangdata.com.cn/",
    "中新网":
        "https://www.chinanews.com/sh/2023/11-09/10109090.shtml",
    "央广网":
        "https://www.cnr.cn/hunan/flxw/wl/20231108/t20231108_526479383.shtml",
    "腾讯新闻":
        "https://news.qq.com/rain/a/20211020A0A3EE00",
    "消费日报":
        "http://www.clii.com.cn/zhhylm/zhhylmHangYeJuJiao/202203/t20220311_3953213.html",
    "华声在线":
        "https://hunan.voc.com.cn/",
    "维基百科":
        "https://zh.wikipedia.org/wiki/%E7%91%B6%E6%97%8F%E9%95%BF%E9%BC%93%E8%88%9E",
    "360 百科":
        "https://baike.so.com/doc/858308-907478.html",
    "国务院":
        "https://www.gov.cn/gongbao/content/2008/content_1025937.htm",
    "抖音":
        "https://www.douyin.com/",
}

# 同一机构在不同主题里指向不同条目：按「来源原文」覆盖默认链接。
SOURCE_LINK_OVERRIDES = {
    "中国非物质文化遗产网 ihchina.cn": {
        "中国非物质文化遗产网": "https://www.ihchina.cn/art/detail/id/11280.html",
    },
    "中国非物质文化遗产网官方项目页原文": {
        "中国非物质文化遗产网": "https://www.ihchina.cn/project_details/12474.html",
    },
    "知网空间「三朝书」词条；万方《江永〈三朝书〉中图案研究及服装创新设计》": {
        "知网空间": "https://wiki.cnki.com.cn/HotWord/2144601.htm",
    },
    "湖南省文化和旅游厅《江华瑶家手工艺品的瑰宝：“八宝被”织锦》(2015-12-01)": {
        "湖南省文化和旅游厅": "http://whhlyt.hunan.gov.cn/",
    },
    "抖音；仅作公众关注度参考，不作学术引用": {
        "抖音": "https://www.douyin.com/video/7438907555595799844",
    },
    "同上": {
        "同上": "http://www.jh.gov.cn/jh/yzwh/202206/101c4ae631474ab9a86f74d8afa0762c.shtml",
    },
}

_TAG_SPLIT = re.compile(r"(<[^>]+>)")
_CODE_TAG = re.compile(r"<code>([^<]+)</code>")
_OPEN_A = re.compile(r"<a(?:\s|>)", re.I)
_CLOSE_A = re.compile(r"</a\s*>", re.I)


def _plain_text(text):
    """去掉标签、还原实体、压平空白，用于按原文匹配覆盖链接。"""
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", "", text))).strip()


def _code_url(text):
    """把 <code> 里的域名/路径补成 https/http 地址。"""
    t = text.strip()
    if t.startswith("http://") or t.startswith("https://"):
        return t
    if not re.match(r"^[a-z0-9.-]+\.[a-z]{2,}(?:[/?#]|$)", t, re.I):
        return None
    if t.startswith("ihchina.cn"):
        return "https://www." + t
    if t.startswith("douyin.com"):
        return "https://www." + t
    if t.startswith("gxfc.gov.cn"):
        return "http://www." + t
    if t.startswith("github.com") or t.startswith("www."):
        return "https://" + t
    return "https://" + t


def _link_codes(text):
    def repl(m):
        raw = m.group(1)
        url = _code_url(raw)
        if not url:
            return m.group(0)
        return ('<a class="src-link src-link--code" href="%s" target="_blank" rel="noopener noreferrer">'
                '<code>%s</code></a>' % (url, raw))
    return _CODE_TAG.sub(repl, text)


def _link_names(text, urls):
    token_re = re.compile("|".join(
        re.escape(t) for t in sorted(urls, key=len, reverse=True)))
    depth = 0
    out = []
    for part in _TAG_SPLIT.split(text):
        if part.startswith("<"):
            if _OPEN_A.match(part):
                depth += 1
            elif _CLOSE_A.match(part):
                depth = max(0, depth - 1)
            out.append(part)
        elif depth:
            out.append(part)
        else:
            out.append(token_re.sub(
                lambda m: '<a class="src-link" href="%s" target="_blank" rel="noopener noreferrer">%s</a>'
                % (urls[m.group(0)], m.group(0)), part))
    return "".join(out)


def linkify_source(text):
    """给来源单元格加外链；已经加过就原样返回（可重复执行）。"""
    if 'class="src-link"' in text:
        return text
    urls = dict(SOURCE_LINK_TOKENS)
    urls.update(SOURCE_LINK_OVERRIDES.get(_plain_text(text), {}))
    return _link_names(_link_codes(text), urls)


def srctable(rows):
    """资料来源表：面向公众，只写「说了什么 / 出处」，不列内部 A/B/C/D 分级。"""
    tr = "".join(
        '<tr><td class="g">%s</td><td>%s</td><td>%s</td></tr>'
        % (k, t, linkify_source(u)) for (k, lv, t, u) in rows)
    return ('<table class="src"><tr><th>内容</th><th>说明</th><th>来源</th></tr>%s</table>' % tr)


def visual_lab(m):
    notes = THEME_NOTES[m["key"]]
    spec = "".join(
        '<div class="spec-row"><dt>%s</dt><dd><b>%s</b><span>%s</span></dd></div>'
        % (no, label, value) for no, label, value in notes["spec"])
    return """<section class="pattern-lab" id="pattern" aria-labelledby="labTitle">
  <div class="wrap">
    <div class="lab-head">
      <div>
        <p class="eyebrow"><i></i>PATTERN SYSTEM / 纹样系统</p>
        <h2 id="labTitle">%(title)s</h2>
      </div>
      <p class="lab-lede">%(copy)s</p>
    </div>
    <div class="pattern-workbench">
      <div class="pattern-stage" id="patternStage" data-mode="unit" aria-label="%(cn)s纹样构成工作台">
        <span class="stage-label">FIG. 01 / PATTERN STUDY</span>
        <span class="stage-mode">UNIT / 单元</span>
        <div class="stage-plane">
          <div class="motif-unit" data-motif-unit aria-hidden="true"></div>
          <div class="motif-repeat" data-motif-repeat aria-hidden="true"></div>
        </div>
        <span class="stage-coords">FRAME / OCTAGON · 8 SIDES<br>CORE / %(key_upper)s</span>
      </div>
      <div class="lab-side">
        <div class="mode-switch" role="tablist" aria-label="纹样视图切换">
          <button type="button" role="tab" data-view="unit" aria-selected="true">UNIT / 单元</button>
          <button type="button" role="tab" data-view="frame" aria-selected="false" tabindex="-1">FRAME / 骨架</button>
          <button type="button" role="tab" data-view="repeat" aria-selected="false" tabindex="-1">REPEAT / 连续</button>
        </div>
        <dl class="spec-list">%(spec)s</dl>
        <p class="lab-note"><b>视觉转译说明 /</b> 工作台中的几何为本站转译，不是对传统纹样的考古复原；
        切换视图看的是结构关系，而不是给纹样重新命名。</p>
      </div>
    </div>
  </div>
</section>""" % dict(title=notes["lab_title"], copy=notes["lab_copy"], cn=m["cn"],
                     spec=spec, key_upper=m["key"].upper())


def field_section(m):
    notes = THEME_NOTES[m["key"]]
    items = GALLERY[m["key"]]
    figures = []
    for idx, item in enumerate(items, 1):
        figures.append(
            '<figure class="field-card">'
            '<span class="field-no">PLATE %02d</span>'
            '<div class="field-media"><img src="%s" width="%s" height="%s" alt="%s" loading="lazy" decoding="async"></div>'
            '<figcaption><b>%s</b><span>%s</span></figcaption>'
            '</figure>'
            % (idx, item["src"], item["w"], item["h"], item["alt"], item["caption"], item["source"]))
    count = "01—%02d / %02d 张图版" % (len(items), len(items))
    return """<section class="field-section" id="field" aria-labelledby="fieldTitle">
  <div class="wrap">
    <div class="field-head">
      <div>
        <p class="eyebrow"><i></i>FIELD PLATES / 现场图版</p>
        <h2 id="fieldTitle">%(title)s</h2>
        <p>%(copy)s</p>
      </div>
      <span class="field-count">%(count)s</span>
    </div>
    <div class="field-track" aria-label="%(cn)s现场图片">
      %(figures)s
    </div>
  </div>
</section>""" % dict(title=notes["field_title"], copy=notes["field_copy"],
                     cn=m["cn"], count=count, figures="\n      ".join(figures))


def sound_line(m):
    return """<section class="sound-line" id="sound" aria-labelledby="soundTitle">
  <div class="wrap sound-grid">
    <div class="sound-copy">
      <p class="eyebrow"><i></i>SOUND TRACE / 声音轨迹</p>
      <h2 id="soundTitle">听见这一章</h2>
      <p>播放的是本章对应的真实音频短片段。波形由 Web Audio API 对正在播放的声音实时分析，
      未播放时保持静止；完整录音与来源说明见声音数据库。</p>
      <a class="sound-cta" href="../database.html#/sounds"><b>继续查看声音档案</b><span>↗</span></a>
    </div>
    <div class="sound-player-wrap">
      <div class="audio-player audio-player--theme" data-audio-player data-key="%(key)s"></div>
    </div>
  </div>
</section>""" % dict(key=m["key"])


def foot(current):
    idx = next(i for i, c in enumerate(CHAPTERS) if c["href"] == current)
    next_ch = CHAPTERS[(idx + 1) % len(CHAPTERS)]
    chips = []
    for c in CHAPTERS:
        cls = " is-current" if c["href"] == current else ""
        aria = ' aria-current="page"' if c["href"] == current else ""
        chips.append(
            '<a class="%s" href="%s" style="--chip:%s;--chip-fg:%s"%s>'
            '<span class="cs-no">%s / 06</span><span class="cs-cn">%s</span>'
            '<span class="cs-en">%s</span></a>'
            % (cls.strip(), c["href"], c["color"], c["fg"], aria,
               c["num"], c["cn"], c["en"]))
    return """<footer class="theme-foot">
  <div class="wrap">
    <div class="next-chapter">
      <div>
        <span class="next-label">NEXT CHAPTER / 下一章</span>
        <a class="next-link" href="%(next_href)s">
          <span>
            <span class="next-index">%(next_num)s / 06 · %(next_en)s</span>
            <strong>%(next_cn)s</strong>
          </span>
          <span class="next-arrow" aria-hidden="true">→</span>
        </a>
      </div>
      <p class="next-note">继续查看下一章，或从下方的六章色带跳转。</p>
    </div>
    <nav class="chapter-strip" aria-label="六章色带">
      %(chips)s
    </nav>
    <div class="foot-meta">
      <p>本站收录潇贺古道沿线六项文化遗产。图片与影像版权归原作者及发布机构所有，仅作非商业性的文化展示；
      引用请回到各页「资料来源」。<br><a href="01-潇贺古道.html">总述 · 潇贺古道</a> /
      <a href="08-上灯炸龙.html">附 · 上灯炸龙</a> /
      <a href="../database.html#/archive">文化档案</a></p>
      <p class="foot-credit">潇贺古道有声文化数据库</p>
    </div>
  </div>
</footer>""" % dict(next_href=next_ch["href"], next_num=next_ch["num"],
                     next_en=next_ch["en"], next_cn=next_ch["cn"], chips="\n      ".join(chips))


# ---------------------------------------------------------------- 页面外壳

PAGE = """<!DOCTYPE html>
<html lang="zh-CN" class="no-js">
<head>
<meta charset="utf-8">
<script>
document.documentElement.classList.remove('no-js');
document.documentElement.classList.add('js');
if(location.search.indexOf('arrive=')>-1){
  document.documentElement.classList.add('is-arriving');
  window.setTimeout(function(){
    var v=document.getElementById('arrivalVeil'),t=document.getElementById('arrivalTitle');
    document.documentElement.classList.add('is-revealing');
    window.setTimeout(function(){
      document.documentElement.classList.remove('is-arriving','is-revealing','is-arrival-landed');
      if(v)v.style.display='none';
      if(t)t.style.display='none';
    },680);
  },6000);
}
</script>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%%CN%% · 潇贺古道有声文化数据库</title>
<meta name="description" content="%%DESC%%">
<link rel="canonical" href="%%SELFURL%%">
<meta property="og:type" content="article">
<meta property="og:site_name" content="潇贺古道有声文化数据库">
<meta property="og:title" content="%%CN%% · 潇贺古道有声文化数据库">
<meta property="og:description" content="%%DESC%%">
<meta property="og:url" content="%%SELFURL%%">
<meta property="og:image" content="https://hpairr.github.io/xiaohe-gudao/assets/img/og-cover.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="zh_CN">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="%%MAIN%%">
<link rel="icon" type="image/svg+xml" href="../favicon.svg">
<link rel="alternate icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='4' fill='%23F7F4EC'/%3E%3Cpath d='M3 12c1.5 0 1.5-4.5 3-4.5s1.5 9 3 9 1.5-13.5 3-13.5 1.5 9 3 9 1.5-4.5 3-4.5' fill='none' stroke='%23C3272B' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E">
<style>
@font-face{font-family:'Noto Serif SC';src:url('../assets/fonts/site/NotoSerifSC-Bold.woff2') format('woff2');font-weight:700;font-style:normal;font-display:swap}
@font-face{font-family:'Noto Serif SC';src:url('../assets/fonts/site/NotoSerifSC-Medium.woff2') format('woff2');font-weight:500;font-style:normal;font-display:swap}
@font-face{font-family:'Noto Sans SC';src:url('../assets/fonts/site/NotoSansSC-Regular.woff2') format('woff2');font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:'Noto Sans SC';src:url('../assets/fonts/site/NotoSansSC-Medium.woff2') format('woff2');font-weight:500;font-style:normal;font-display:swap}
@font-face{font-family:'Noto Sans Nushu';src:url('../assets/fonts/site/NotoSansNushu-Regular.woff2') format('woff2');font-weight:400;font-style:normal;font-display:swap}
</style>
<link rel="stylesheet" href="theme-experience.css">
<link rel="stylesheet" href="../assets/audio-player.css">
%%EXTRA_HEAD%%
<style>:root{--main:%%MAIN%%;--on:%%ON%%;--accent:%%ACCENT%%;--surface:%%SURFACE%%;--deep:%%DEEP%%}</style>
</head>
<body class="theme-page" data-theme="%%KEY%%" data-audio-base="../assets/audio/">
<a class="skip-link" href="#main">跳到正文</a>
<div class="arrival-veil" id="arrivalVeil" aria-hidden="true"></div>
<div class="arrival-title%%ARRIVAL_LONG%%" id="arrivalTitle" aria-hidden="true">%%CN%%</div>
%%NAV%%
<main id="main">
%%HERO%%
%%PRELUDE%%
%%SECTIONS%%
%%SOUND%%
</main>
%%FOOT%%
%%SOURCES%%
<script src="../assets/audio-player.js" defer></script>
<script src="../assets/leave-guard.js" defer></script>
<script src="assets/motifs.js" defer></script>
<script src="experience.js" defer></script>
%%EXTRA_SCRIPTS%%
</body>
</html>
"""

# ---------------------------------------------------------------- 女书字帘
#
# 只在 02-女书.html 首页下方插入。帘子的 144 个女书字由
# themes/assets/nushu-dict.js 提供（见 themes/scripts/build_nushu_dict.py），
# 交互在 themes/assets/nushu-curtain.js；这里只保留无 JS 也能读的骨架。

LEXICON = """<section class="lex-section" id="lexicon" data-step="字" aria-labelledby="lexTitle">
  <div class="wrap">
    <div class="story-grid">
      <aside class="story-rail" aria-hidden="true">
        <span class="story-no">字</span>
        <span class="story-en">Lexicon</span>
        <i></i>
      </aside>
      <div class="story-main">
        <div class="story-head">
          <h2 id="lexTitle">展开的女书字典</h2>
          <span class="en-tag">A dictionary, unfolded</span>
        </div>
        <p class="lex-lede">女书是表音文字：一个字代表一个音节，常可记写一组同音汉字。帘上从 Unicode 女书标准字表的 396 个女书字中取了 144 个，每个只出现一次。点任意一字，它会落进字格——对应汉字、江永方言读音与释义随字展开。</p>
        <div class="lex-stage" id="lexStage">
          <div class="lex-curtain-wrap">
            <div class="lex-bar">
              <span>帘上 144 字 · 每字只出现一次</span>
              <span>点击 / Enter 查阅</span>
            </div>
            <div class="lex-curtain" id="lexCurtain" role="group" aria-label="女书字帘：144 个女书字，每个只出现一次" aria-describedby="lexHelp"></div>
            <p class="lex-sr" id="lexHelp">用方向键在字帘上移动，按回车查阅当前字；也可以直接点击任意一个字。</p>
            <noscript><p class="lex-noscript">字帘需要 JavaScript。可先前往 <a href="https://nushuscript.org/">在线女书字典</a> 查询；完整字表见页面底部来源。</p></noscript>
          </div>
          <aside class="lex-card" id="lexCard" aria-label="女书字义查阅卡">
            <div class="lex-card-head">
              <span class="lex-kicker">LOOKUP / 字格</span>
              <span class="lex-serial" id="lexSerial">— / 396</span>
              <button class="lex-close" id="lexClose" type="button" aria-label="放回帘上并关闭" hidden>×</button>
            </div>
            <div class="lex-slot" id="lexSlot" aria-hidden="true">
              <span class="lex-slot-glyph" id="lexSlotGlyph"></span>
              <span class="lex-slot-hint" id="lexSlotHint">点帘上任意一字<br><b>它会落进这个方格</b></span>
              <i class="lex-corner lex-corner--tl"></i><i class="lex-corner lex-corner--tr"></i>
              <i class="lex-corner lex-corner--bl"></i><i class="lex-corner lex-corner--br"></i>
            </div>
            <div class="lex-read" id="lexRead" aria-live="polite" aria-atomic="true">
              <div class="lex-focus-row">
                <span class="lex-focus" id="lexFocus">—</span>
                <span class="lex-focus-label">本页取义</span>
              </div>
              <div class="lex-pron-row">
                <span class="lex-pron" id="lexPron">—</span>
                <span class="lex-tone" id="lexTone"></span>
                <span class="lex-pron-note">江永方言</span>
              </div>
              <p class="lex-gloss" id="lexGloss">女书一个字对应一个音节，常可记写多个同音汉字。选一个字，看看它能写什么。</p>
              <details class="lex-all" id="lexAll" hidden>
                <summary>全部对应汉字 <span id="lexHanCount"></span></summary>
                <div class="lex-han-list" id="lexHanList"></div>
              </details>
            </div>
            <div class="lex-card-foot">
              <span class="lex-card-src">NUSHU / UNICODE</span>
              <a class="lex-card-link" href="https://nushuscript.org/" target="_blank" rel="noopener">字表来源 ↗</a>
            </div>
          </aside>
        </div>
        <div class="lex-foot">
          <p><b>凡例</b> 女书一字一音，可记写多个同音汉字；卡上的「本页取义」只取其中一个常用义，不是唯一解释。读音后的数字为江永方言调值<span class="lex-nb">（5 度制）</span>。字表据赵丽明、徐焰编纂《女书规范字书法字帖》（Unicode 标准），由 Nushu Developers Workgroup 整理为在线字表；字形为 Noto Sans Nüshu（SIL OFL）。</p>
          <a href="https://nushuscript.org/" target="_blank" rel="noopener">nushuscript.org ↗</a>
        </div>
      </div>
    </div>
  </div>
</section>"""

# ---------------------------------------------------------------- 六页内容
#
# 文案口径（重要）：
#   事实层与视觉转译层分开写：史实、名录、数据仍按来源核对；
#   纹样工作台中的几何明确标为「本站视觉转译，不是传统纹样复原」。
#   每条事实都标出处；出处分级 A 官方 / B 学术 / C 媒体 / D 公众（仅作认知参考）。
# 待核对项集中在该主题来源节的「说明」一栏，用 ⚠ 标出。

def page_road():
    m = dict(
        cn="潇贺古道", en="Xiaohe Ancient Road", key="road",
        lead="连接湖南潇水流域与广西贺江流域的古代陆路通道。秦代开凿灵渠、修筑「新道」之后，"
             "中原经湘南进入岭南不再必须绕行，这条道成为长江水系与珠江水系之间最便捷的陆上连接。",
        badges=["战国至秦代开通", "陆路约 170 公里", "跨湘桂两省区", "沿线村镇 30 余处"],
        motif="路线示意：道县至贺州，沿线关隘、古城与村落",
        main="#3A5BA0", accent="#C3271B", deep="#1F2D3D")
    secs = []

    secs.append(sec("01", "古道概况", "Overview",
        """<div class="prose">
        <p>潇贺古道北起湖南道县潇水之滨，南抵广西贺州贺江沿岸，是一条<b>穿越南岭、
        连通湘桂的古代陆路通道</b>。它的开通使中原地区不必绕行湘桂走廊以西，
        即可由长江水系进入珠江水系。</p>
        <p>古道并非一条固定的路，而是<b>由若干条路线组成的通道体系</b>。沿线分布着关隘、驿道、
        古村落、桥梁与衙署，其中相当一部分至今仍有实体遗存，是研究南岭地区交通、
        商贸与人口迁徙的重要实物资料。</p>
        <p class="soft">沿线主要节点：道县 → 江永 → 谢沐关 → 富川 → 贺州。
        各条目按通道、遗迹、非遗、人物四类归入「文化档案」，并可在「古道图志」中按沿线城市查看。</p>
        </div>"""))

    secs.append(sec("02", "历史脉络", "History",
        """<div class="prose">
        <p>南岭横亘于湘、桂、粤之间，长期阻隔南北交通。秦代以前，此地仅有山间小路可通。
        秦统一岭南的过程中，为转运粮秣、巩固对新占地区的控制，<b>开凿灵渠并修筑「新道」</b>，
        潇贺古道即在此背景下形成。</p>
        <p>此后两千余年间，古道一直是湘南与桂东之间的主要陆路通道。唐宋以降，
        沿线陆续设置关隘与驿铺；明清时期，随着人口迁入与商贸往来，沿线的村落、
        风雨桥、庙宇与宗祠大量兴建，形成今天的聚落格局。</p>
        <p>近代公路与铁路兴起后，古道的交通功能逐渐退出，但沿线的物质与非物质文化遗产
        保留了下来。</p>
        </div>
        <div class="grid2" style="margin-top:8px">
          <div class="card"><h3>为什么重要</h3>
          <p>古道是<b>中原文化与岭南原住民文化交汇的通道</b>。语言、文字、民歌、服饰、
          建筑工艺在沿线相互影响，形成了本区域独特的文化面貌。</p></div>
          <div class="card"><h3>今天能看到什么</h3>
          <p>临贺故城、富川明城遗址等城址聚落；回澜风雨桥等桥梁；秀水、福溪、
          岔山等历史文化名村；以及女书、蝴蝶歌、长鼓舞等活态非遗。周边古镇另见黄姚（昭平）。</p></div>
        </div>"""))

    secs.append(sec("03", "沿线节点与数据", "Along the route",
        figs([("约 170", "公里 · 陆路", "道县至贺州"),
              ("5", "主要城镇（含周边）", "道县 · 江永 · 富川 · 贺州 · 昭平"),
              ("30+", "沿线村寨", "估算 · 含历史文化名村"),
              ("2", "水系", "潇水 → 贺江，连通长江与珠江")]) +
        cards([("道县", "古道北端起点，潇水自城下南流。境内有月岩、周敦颐故里等古迹。"),
               ("江永", "古道上重要的过境段，女书流传地。上甘棠村保存有完整的明清村落格局。"),
               ("富川", "进入广西后的核心段落。风雨桥群、古明城遗址与乡间石板路并存。"),
               ("贺州", "古道南端终点。临贺故城为汉代城址，「贺」这一地名的源头。"),
               ("昭平", "贺江下游，黄姚古镇所在地，国家历史文化名镇。")])))

    secs.append(sec("04", "资料来源", "Sources",
        srctable([
            ("古道性质与走向", "A", "北接潇水、南通贺江，连通长江水系与珠江水系",
             "中国非物质文化遗产网 <code>ihchina.cn</code>"),
            ("交通地位", "C", "被视为海陆丝绸之路的重要陆路通道",
             "周大鸣《交融古今，通达天下：潇贺古道的历史与人文价值》，光明日报 2022-04-20"),
            ("开通年代", "A", "秦代开凿灵渠并修筑「新道」；始建年代（前 219 年）为通行口径，学界有讨论",
             "国务院及地方志书通行表述；⚠ 学界存在不同意见"),
            ("富川段路面遗存", "A", "青石板路、鹅卵石路及石面马蹄磨痕",
             "富川瑶族自治县人民政府官网 <code>gxfc.gov.cn</code>"),
            ("沿线文物保护单位", "A", "临贺故城（第五批国保）、富川瑶族风雨桥群（第七批国保）等",
             "国务院公布全国重点文物保护单位名录"),
        ]),
        "以上数据以政府公开信息与非物质文化遗产名录为准；里程数随线路取法而变，表中为通行说法。「沿线村寨 30 余处」是按已列入历史文化名村、传统村落名录的聚落估算，不是普查数。"))

    return m, secs


def page_nushu():
    m = dict(
        cn="女书", en="Nüshu", key="nushu",
        plate=("01", "女书手稿、扇书与三朝书内页", "江永女书生态博物馆藏件"),
        lead="流传于湖南江永一带的女性专用文字，2006 年列入第一批国家级非物质文化遗产名录。"
             "字形纤瘦右斜、菱角分明，基本笔画只有点、竖、斜、弧四种，写在纸扇、手帕和三朝书上。",
        badges=["国家级非遗 · 2006 第一批", "目前已知唯一女性文字", "已入 Unicode", "载体：扇书 · 帕书 · 三朝书"],
        motif="女书字形与书写载体（扇面、手帕、三朝书）",
        main="#1D2652", accent="#D2A03F", deep="#101735", on="#F2EDE2")
    secs = []

    secs.append(sec("01", "女书是什么", "What it is",
        """<div class="prose">
        <p>女书，又名「女字」，是<b>目前已知世界上唯一由女性专门使用的文字</b>，
        长期流传于湖南省江永县及其邻近地区。它记录的是当地汉语方言，字字独立、成篇成章，
        可以唱读，也可以书写。</p>
        <p>字形<b>呈长菱形，左低右高</b>，笔画纤细。结构上，
        女书的笔画只有<em>点、竖、斜、弧</em>四种，形态统一，辨识度较高。</p>
        <p class="soft">研究者把女书称为「双体系」：它既是一套文字符号，也有一套以「八角花」为代表的装饰图案。</p>
        </div>"""))

    secs.append(sec("02", "书写与传承", "Script and transmission",
        """<div class="prose">
        <p>女书主要用于<b>女性之间的通信与记录</b>。使用者用它写结交书、记姊妹往来，也记录心事。
        女书在女性之间代代相传，往往由母亲教给女儿，或由年长的姊妹传授。</p>
        <p>书写载体以三种最为典型：<b>扇书</b>（写在纸扇上）、<b>帕书</b>（写在手帕上）、
        <b>三朝书</b>（新娘出嫁后第三天，姊妹赠送的线装册页）。此外也见于织锦、
        刺绣与剪纸。</p>
        <p>传统习俗中有「人死书焚」的讲究：使用者去世后，其女书作品多被焚化或随葬。
        这一习俗使早期实物留存极少，也是女书一度濒危的重要原因。</p>
        </div>
        <div class="grid2" style="margin-top:8px">
          <div class="card"><h3>三朝书</h3>
          <p>三朝书是女书最重要的载体形式之一。册页正中多绘「八角花」纹样，
          四周书写女书文字，内容多为姊妹间的劝慰与祝福。</p></div>
          <div class="card"><h3>唱读</h3>
          <p>女书可以按固定曲调唱读。唱读时音调高低起伏，与书写同为女书传承的一部分。</p></div>
        </div>"""))

    secs.append(sec("03", "八角花", "The octagonal flower motif",
        """<div class="prose">
        <p>八角花的外廓为八角八边，由八条连弧纹构成，八个夹角内常绘有长短横式的符号；外廓形态与战国楚铜镜背面的菱形纹样相近，被认为一脉相承。</p>
        <p>内芯的题材很多：牡丹、莲花、蝴蝶、凤鸟、鱼龙等吉祥纹样都可入内。学者统计，女书原件上的八角花纹样有 30 余种。外框基本固定，内芯随题材变化，这是女书装饰图案的一个特点。</p>
        </div>"""
        + files_figs("01-女书（八角花·字形）") +
        cards([("分布位置", "八角花多居于三朝书内页正中，四周书写女书文字；扇书、帕书同样如此。"),
               ("内芯题材", "不同类别的八角花内部构成不尽相同，但都取自民间吉祥纹样。"),
               ("学术研究", "《艺术探索》2009 年第 1 期《女书与「八角花」图案》将女书定义为"
                          "「文字符号体系 + 装饰性图案文化符号体系」双体系。")])))

    secs.append(sec("04", "资料来源", "Sources",
        srctable([
            ("名录级别", "A", "女书习俗列入第一批国家级非物质文化遗产名录（2006）",
             "中国非物质文化遗产网 <code>ihchina.cn</code>"),
            ("字形结构", "C", "长菱形、左低右高、瘦长；笔画仅有点、竖、斜、弧四种",
             "《女书字体特点》等公开资料"),
            ("双体系定义", "B", "「文字符号体系 + 装饰性图案文化符号体系」",
             "《女书与「八角花」图案》，《艺术探索》2009 年第 1 期"),
            ("八角花外框", "C", "八角八边连弧纹；「八角花」即「八卦花」（当地方言同音）",
             "《女书文化：织锦、刺绣、八角花篇》，搜狐 2018"),
            ("八角花内芯", "B", "原件纹样 30 余种，不同类别内部构成不尽相同，皆取自民间吉祥纹样",
             "知网空间「三朝书」词条；万方《江永〈三朝书〉中图案研究及服装创新设计》"),
            ("与楚文化关联", "C", "外廓八条连弧与战国楚铜镜背面菱形纹一脉相承",
             "《女书文化：织锦、刺绣、八角花篇》"),
            ("三朝书形制", "B", "内页正中绘八角花、四周书写女书文字",
             "《女书「三朝书」探析》，《民族艺术》2013 年第 3 期"),
            ("传承与当代实践", "C", "传承人以设计与文创作品推动女书进入现代生活",
             "中新网 2023-11-09《世界唯一女性文字「走」出纸张》；央广网 2023-11-08"),
            ("字形数据", "A", "女书已纳入 Unicode；Noto Sans Nüshu 采用 SIL OFL 授权",
             "<code>github.com/arrowtype/noto-sans-nushu</code>"),
        ]),
        ""))

    return m, secs


def page_butterfly():
    m = dict(
        cn="蝴蝶歌", en="Butterfly Song", key="butterfly",
        plate=("02", "蝴蝶歌对唱与歌会现场", "富川白沙镇 / 节庆歌会"),
        lead="富川瑶族自治县瑶族多声部民歌，2008 年列入第二批国家级非物质文化遗产名录"
             "（项目序号 61，编号 Ⅱ-30，扩展项目）。因衬词「蝴的蝶」得名，"
             "两个声部同起同收，被称作「流淌在翅膀上的山歌」。",
        badges=["国家级非遗 · 2008 第二批", "二声部民歌", "衬词「蝴的蝶」", "代表性传承人：欧玉梅"],
        motif="两个声部的旋律线：由分开走向合一",
        main="#B8862F", accent="#2C5A4E", deep="#7A5A1C", on="#141A16")
    secs = []

    secs.append(sec("01", "蝴蝶歌是什么", "What it is",
        """<div class="prose">
        <p>蝴蝶歌是<b>流传于广西富川瑶族自治县的瑶族多声部民歌</b>，用当地瑶语演唱。
        演唱时由两人或两组分声部同时进行，<b>两个声部同起同收</b>，
        声部之间既有区分又始终贴合。</p>
        <p>它的音乐特征见诸官方记录：和声<b>以大小三度为主</b>，
        也常出现<b>长时值的大二度，然后解决到同度</b>。听感上，两个声部由分开走向合一。</p>
        <p class="soft">歌名来自歌词中的衬词「蝴的蝶」。当地与媒体报道常以「翅膀」作比，
        广西日报 2023 年 1 月的报道称它为「流淌在翅膀上的山歌」。</p>
        </div>"""))

    secs.append(sec("02", "唱法与场合", "Performance and occasions",
        """<div class="prose">
        <p>蝴蝶歌由两人或两组分声部演唱，两个声部同起同收。
        衬词是这首歌显著的听觉标志，演唱中大量使用「蝴的蝶」等衬词，
        既填补乐句，也构成节奏。</p>
        <p>传统上，蝴蝶歌多在<b>节庆、歌会与日常劳作场合</b>演唱，
        是当地瑶族社交生活的一部分。近年来它也进入展演与比赛舞台，
        并入选中国原生民歌节等全国性活动。</p>
        <p>传承上，富川当地代表性传承人<b>欧玉梅</b>（第四代，白沙镇）等人
        通过交流与实践探索蝴蝶歌与现代音乐的融合，吸引年轻人参与。</p>
        </div>
        <div class="grid2" style="margin-top:8px">
          <div class="card"><h3>二声部 · 同起同收</h3>
          <p>两个声部同时开始、同时结束，中途各自展开。这是蝴蝶歌的基本形态。</p></div>
          <div class="card"><h3>大二度 → 同度</h3>
          <p>长时值的大二度音程解决到同度，被记为富川瑶族音乐独有的特点，
          也是它在音乐学上最受关注之处。</p></div>
        </div>"""))

    secs.append(sec("03", "记录与现状", "Records and status",
        figs([("Ⅱ-30", "项目编号", "多声部民歌 · 扩展项目"),
              ("2008", "列入年份", "第二批国家级非遗"),
              ("2", "声部数", "同起同收"),
              ("富川", "申报地区", "广西壮族自治区富川瑶族自治县")]) +
        files_figs("02-蝴蝶歌") +
        cards([("当代使用", "蝴蝶歌已被用于传唱非传统内容，如广西纪检监察网 2021 年报道的"
                          "「蝴蝶歌唱出廉政好声音」。"),
               ("研究文献", "《广西瑶族多声部民歌和声特征研究——以蝴蝶歌〈流水欢歌迎客来〉"
                          "〈情郎下海我下海〉为例》（《黄河之声》2022 年第 8 期）等。"),
               ("文献情况", "蝴蝶歌的现存记录以曲谱、录音与影像为主，未见传统纹样类实物。"
                          "网络上流传的「蝴蝶纹样」没有可靠出处。")])))

    secs.append(sec("04", "资料来源", "Sources",
        srctable([
            ("名录级别", "A", "第二批国家级非遗（2008），项目序号 61，编号 Ⅱ-30，扩展项目；"
             "申报地区广西富川瑶族自治县",
             "国务院第二批国家级非物质文化遗产名录；<code>ihchina.cn/project_details/12474.html</code>"),
            ("和声特征", "A", "和声音程以大小三度为主，经常出现长时值的大二度音程，然后解决到同度",
             "中国非物质文化遗产网官方项目页原文"),
            ("报道用语", "C", "「流淌在翅膀上的蝴蝶歌」",
             "广西日报 2023-01-11；国际在线同期报道"),
            ("代表性传承人", "A", "欧玉梅（第四代，富川白沙镇）",
             "<code>ihchina.cn/ccr_detail/29903.html</code>"),
            ("音乐本体研究", "B", "《广西富川瑶族合唱作品〈蝴蝶歌〉音乐本体研究》",
             "《黄河之声》2022 年第 14 期"),
            ("当代融合实践", "C", "传承人探索蝴蝶歌与现代音乐的融合，吸引年轻人加入",
             "搜狐文化 2025《以喉为「翅」唱响融合新旋律》"),
            ("非音乐场合使用", "C", "富川：蝴蝶歌唱出廉政好声音",
             "广西纪检监察网 2021-12"),
        ]),
        ""))

    return m, secs


def page_drum():
    m = dict(
        cn="长鼓舞", en="Long Drum Dance", key="drum",
        plate=("03", "长鼓舞表演与长鼓形制", "富川高台长鼓舞"),
        lead="瑶族传统舞蹈，2008 年列入第二批国家级非物质文化遗产名录。因所用鼓身细长而得名，"
             "瑶语称「郭咚郭」，宋代已见记载（当时名「铙鼓」「铳鼓」）。"
             "广西贺州、富川一带流传的是高台长鼓舞分支。",
        badges=["国家级非遗 · 2008 第二批", "鼓身细长 · 中腰束腰", "宋代已流传", "富川分支：高台长鼓舞"],
        motif="长鼓形制：两端鼓面、中腰束腰",
        main="#A9362E", accent="#D2A03F", deep="#7A1F1A", on="#F2EDE2")
    secs = []

    secs.append(sec("01", "长鼓舞是什么", "What it is",
        """<div class="prose">
        <p>长鼓舞是瑶族的传统舞蹈，因<b>所用长鼓鼓身细长而得名</b>，
        在瑶语中又称「郭咚郭」「槁」。长鼓为拍击膜鸣乐器，
        形制特征是<b>两端为圆形鼓面、中腰收细</b>，呈束腰状。</p>
        <p>长鼓的历史可追溯至<b>宋代</b>。南宋周去非《岭外代答》卷七「猺乐器」记：
        「猺人之乐，有卢沙、铳鼓、胡卢笙、竹笛……<b>铳鼓乃长大腰鼓也，长六尺</b>，
        以燕脂水为腔，熊皮为面。」——鼓名、形制与今之长鼓相合。
        他书亦写作「铙鼓」，明清两代沿用此名。就其源流而言，长鼓被认为由古代细腰鼓演化而来，
        而细腰鼓是流行于亚欧大陆的乐器形制。</p>
        <p class="soft">舞蹈动作体系据载有<b>七十二套</b>，表演时舞者边击鼓边舞蹈，
        身姿「曲身拧转」，场面多为围圈进行。</p>
        </div>"""))

    secs.append(sec("02", "分支与形制差异", "Regional branches",
        figs([("2008", "列入年份", "第二批国家级非遗"),
              ("72", "套动作", "据载的动作体系"),
              ("宋", "文献年代", "时称铙鼓 / 铳鼓"),
              ("1:2.6", "中腰 : 鼓面", "据教学片画面量取")]) +
        cards([("湖南江华", "流传于江华瑶族自治县及邻近瑶族地区，是长鼓舞的代表性流传区域之一。"),
               ("广西金秀", "坳瑶支系的「黄泥鼓舞」，为祭祀盘王活动的重要内容，形制与一般长鼓不同。"),
               ("广西富川", "流传「高台长鼓舞」，与蝴蝶歌同为当地对外展演的代表项目。")]) +
        '<div class="card" style="margin-top:22px"><h3>分支说明</h3>'
        '<p>江华、金秀、富川的长鼓舞在鼓形与动作上各有传承。资料中常统称「瑶族长鼓舞」，'
        '引用时需要注明申报地区与所属支系。</p></div>'))

    secs.append(sec("03", "记录与展示", "Records and presentation",
        """<div class="prose">
        <p>长鼓舞在官方展演体系中位置稳固。2026 年「文化和自然遗产日」广西主场活动在贺州举行，
        长鼓舞与蝴蝶歌同台展演，同期还有瑶族服饰技艺展。</p>
        <p>在旅游接待场合，长鼓舞也是常见的表演项目，有《广西富川：瑶族风情迎远客》
        等长鼓舞实拍记录。</p>
        </div>"""
        + files_figs("04-长鼓舞")
        + '<p class="sec-note">贺州、富川一带的长鼓形制为两端圆鼓面、中腰束腰。'
          '金秀坳瑶的「黄泥鼓」形制不同。</p>'))

    secs.append(sec("04", "资料来源", "Sources",
        srctable([
            ("名录级别", "A", "瑶族长鼓舞列入第二批国家级非物质文化遗产名录（2008）",
             "国务院第二批国家级非遗名录；<code>ihchina.cn</code>"),
            ("名称与形制", "C", "因鼓身细长而得名，又称花鼓；瑶语称郭咚郭／槁；两端为圆形鼓面、中腰收细",
             "<code>ihchina.cn</code>「瑶族长鼓舞」；瑶语称谓据公开资料，待补文献"),
            ("历史年代", "B", "宋代已见记载；《岭外代答》卷七「猺乐器」：「铳鼓乃长大腰鼓也，长六尺，以燕脂水为腔，熊皮为面」；他书作「铙鼓」",
             "周去非《岭外代答》卷七（维基文库四库全书本）"),
            ("源流", "C", "由古代风靡亚欧大地的细腰鼓演化而来",
             "搜狐《探索神秘的瑶族长鼓》"),
            ("江华分支", "A", "流传在江华及邻近瑶族地区",
             "永州市人民政府网"),
            ("金秀分支", "A", "「黄泥鼓舞」为坳瑶支系，是祭祀盘王活动的重要内容",
             "<code>ihchina.cn/Article/Index/detail?id=13045</code>"),
            ("富川分支", "A", "广西贺州、富川流传「高台长鼓舞」",
             "富川瑶族自治县文旅局《绚烂的瑶族传统文化在保护中传承——瑶族芦笙长鼓舞》"),
            ("同台展演", "A", "2026 年文化和自然遗产日广西主场（贺州）：长鼓舞与蝴蝶歌同台",
             "广西壮族自治区文化和旅游厅官网"),
            ("束腰比例", "D", "中腰直径∶鼓面直径约 1∶2.6，据教学片画面目测量取，误差约 ±5%，不是测绘数据",
             "本站量取（源见「基础教学」一行）"),
        ]),
        "⚠ 乐器形制一项，宋代部分已按《岭外代答》原文补证；瑶语称谓「郭咚郭」「槁」为通行说法，尚缺单一权威文献，标注待补。"))

    return m, secs


def page_bridge():
    m = dict(
        cn="富川风雨桥", en="Wind-Rain Bridge", key="bridge",
        plate=("04", "回澜风雨桥：三孔石拱与桥廊", "富川朝东镇油沐村"),
        lead="富川瑶族风雨桥群现存 27 座，2013 年列入第七批全国重点文物保护单位。"
             "回澜风雨桥由三孔石桥、桥廊、桥亭与阁楼组成。桥名取自韩愈《进学解》"
             "「障百川而东之，回狂澜于既倒」。",
        badges=["全国重点文保 · 2013 第七批", "现存 27 座", "回澜桥 · 三孔石拱", "青龙桥 · 单孔 · 俗称阴阳桥"],
        motif="回澜风雨桥形制：三孔石拱、桥廊与重檐阁楼",
        main="#4C6C8B", accent="#B7C3D6", deep="#2E241D", on="#F2EDE2")
    secs = []

    secs.append(sec("01", "风雨桥是什么", "What it is",
        """<div class="prose">
        <p>风雨桥是南方山区常见的<b>桥廊结合的桥梁</b>：桥身之上覆以廊屋，
        既供通行，也为行人遮风避雨、歇脚聚谈。富川瑶族风雨桥群是其中保存较为完整、
        数量较为集中的一处，<b>现存 27 座</b>，2013 年整体列入第七批全国重点文物保护单位。</p>
        <p>群内最有名的一对是<b>回澜桥与青龙桥</b>，两桥相距不远，当地人合称「阴阳桥」。
        回澜桥为<b>三孔石拱</b>，青龙桥为<b>单孔石拱</b>，一多一少、一阴一阳。</p>
        <p class="soft">回澜桥位于富川县朝东镇油沐村与沐笼村之间的黄沙河上，
        始建于明万历三十年，明崇祯十四年（1641 年）重修，全长 37.54 米。</p>
        </div>"""))

    secs.append(sec("02", "形制与建造", "Construction",
        """<div class="prose">
        <p>以回澜桥为例，其形制为<b>石桥、桥廊、桥亭、阁楼四者的组合</b>：
        下部为石砌拱桥，上部沿桥身建廊，廊间起亭，亭上再叠阁楼，
        屋面多为歇山顶，檐角起翘。</p>
        <p>桥身下部为石拱，上部为木构廊屋，两种材料在立面上分成两层。桥址多选在水流平缓、两岸有村落的河段，便于过往与集散。</p>
        <p>富川风雨桥群数量达 27 座，形制上多为「一桥、一廊、一亭」的基本组合，
        规模与层数随村落财力与地形而变化。</p>
        </div>
        <div class="grid2" style="margin-top:8px">
          <div class="card"><h3>回澜桥</h3>
          <p>三孔石拱桥。桥名取自韩愈《进学解》：「障百川而东之，回狂澜于既倒」。
          始建于明万历三十年，崇祯十四年重修，全长 37.54 米。</p></div>
          <div class="card"><h3>青龙桥</h3>
          <p>单孔石拱桥，始建于明天启四年（1624 年）。由单孔石桥、桥廊、桥亭、
          阁楼组成，中部设一桥亭，歇山屋顶。与回澜桥俗称「阴阳桥」。</p></div>
        </div>"""))

    secs.append(sec("03", "保护与现状", "Preservation",
        figs([("27", "现存座数", "第七批全国重点文物保护单位"),
              ("37.54", "回澜桥全长 · 米", "三孔石拱 + 廊 + 亭 + 阁"),
              ("1641", "重修年份", "明崇祯十四年"),
              ("1624", "青龙桥始建", "明天启四年")]) +
        files_figs("05-风雨桥") +
        cards([("官方测绘", "国家文物局已完成「富川瑶族自治县风雨桥群中 27 座风雨桥」的本体平面图、"
                          "立面图、剖面图及保护矢量图绘制。"),
               ("修缮", "2021 年，27 座古风雨桥修缮后首次集齐；2023 年，古桥加装保护设施。"),
               ("桥名典故", "「回澜」取自韩愈《进学解》「障百川而东之，回狂澜于既倒」。")])))

    secs.append(sec("04", "资料来源", "Sources",
        srctable([
            ("名录级别", "A", "富川瑶族风雨桥群列入第七批全国重点文物保护单位（2013）；现存 27 座",
             "富川瑶族自治县人民政府官网 <code>gxfc.gov.cn</code>"),
            ("回澜桥形制", "A", "三孔石桥 + 桥廊 + 桥亭 + 阁楼；全长 37.54 米；始建明万历三十年，崇祯十四年重修",
             "富川县政府官网；全长 37.54 米（广西区图）；另记桥长 30.43 米"),
            ("青龙桥形制", "A", "单孔石拱，始建于明天启四年（1624 年）；与回澜桥俗称「阴阳桥」",
             "富川县政府官网"),
            ("桥名典故", "D", "取自韩愈《进学解》「障百川而东之，回狂澜于既倒」（网络多误作「会百川而东之，回狂澜之即倒」）",
             "《进学解》原文（维基文库）"),
            ("矢量测绘", "A", "国家文物局已完成 27 座风雨桥本体测绘与保护矢量图绘制（2024-10）",
             "福建省文物局转载国家文物局信息"),
            ("修缮", "C", "2021 年 27 座古风雨桥修缮后首次集齐；2023 年「披上保护衣」",
             "腾讯新闻 2021-10；人民网广西 2023-06"),
            ("艺术特征研究", "B", "《富川瑶乡回澜、青龙风雨桥艺术特征分析》",
             "学术文献，需经学校图书馆检索"),
            ("群体认知", "D", "#富川回澜风雨桥 单条内容获 16.2 万点赞（2024-11）",
             "抖音；仅作公众关注度参考，不作学术引用"),
        ]),
        "⚠ 早期资料中曾把回澜桥写作「双拱」，与官方档案不符，应以三孔石拱为准。⚠ 回澜桥长度两记：全长 37.54 米（广西壮族自治区图书馆），桥长 30.43 米；本页说「全长」。"))

    return m, secs


def page_dragon():
    m = dict(
        cn="上灯炸龙", en="Lantern Lighting & Dragon Firecracking", key="dragon",
        lead="富川瑶族自治县年节民俗，2014 年列入广西壮族自治区第五批非物质文化遗产代表性名录。"
             "每年正月初十至十五举行，核心是「上灯祈愿、炸龙狂欢」两项仪式。",
        badges=["广西自治区级非遗 · 2014", "正月初十上灯 · 十五下灯", "据传明代万历年间", "另有源自宋代一说"],
        motif="上灯与炸龙：花灯、龙身与爆竹火光",
        main="#A8622A", accent="#E0530F", deep="#1A1F2B")
    secs = []

    secs.append(sec("01", "节日概况", "What it is",
        """<div class="prose">
        <p>上灯炸龙节是富川年节期间最热闹的民俗活动，<b>每年正月初十上灯、十五下灯</b>，
        前后持续六天。它由两项内容组成：一是「上灯」，即挂灯祈愿；二是「炸龙」，
        即用爆竹围绕龙身燃放，龙在炮火中穿行。</p>
        <p>关于起源，存在两种说法：一说<b>起源于明代万历年间，距今四百余年</b>；
        一说可上溯至宋代。另有「相传从东南沿海沿古道传入富川」的地方口碑。
        三者并置，尚无定论。</p>
        <p class="soft">官方叙事常把它概括为一场「双主角」的大戏——
        上灯与炸龙是两条并行的线索：一条是祈愿添丁的灯，一条是驱邪迎新的龙。</p>
        </div>"""))

    secs.append(sec("02", "仪式与过程", "Rituals",
        """<div class="prose">
        <p><b>上灯</b>是仪式的起点。据地方报道记录，居民在神楼宰杀公鸡，
        将鸡血淋于神台，焚香烧纸、叩头跪拜，然后挂上花灯，上灯仪式即告完成。
        花灯悬于灯线之上，从初十起逐盏点亮，至十五下灯。</p>
        <p><b>炸龙</b>是节日的高潮。龙在街巷中行进，沿途爆竹自四面八方炸响，
        当地人形容为「炮在人中炸，龙在炮中舞」。火光与烟尘中龙身时隐时现，
        构成这一节日最鲜明的现场印象。</p>
        <p>与炸龙相配套的还有<b>扎龙技艺</b>：龙头、龙身均为手工扎制，
        富川瑶族扎龙技艺已列入自治区级非遗代表性项目。</p>
        </div>
        <div class="grid2" style="margin-top:8px">
          <div class="card"><h3>时间的讲究</h3>
          <p>正月初十上灯、十五下灯，共六天。灯对应「添丁」，
          因此挂灯在当地被视为家族的喜事。</p></div>
          <div class="card"><h3>场面的特征</h3>
          <p>龙由光点断续构成——在炮火与烟尘中，龙身只在火光闪亮的一瞬可见。
          这是现场的真实观感，也是这一节日区别于其他龙舞之处。</p></div>
        </div>"""))

    secs.append(sec("03", "记录与现状", "Records and status",
        figs([("正月初十", "上灯", "至十五下灯，共六天"),
              ("2014", "列入自治区级", "广西第五批非遗名录"),
              ("明万历", "起源 · 一说", "距今四百余年"),
              ("400+", "年 · 据传", "另有源自宋代一说")]) +
        files_figs("06-上灯炸龙") +
        cards([("媒体报道", "新华财经、人民网、中新网、广西新闻网每年持续报道，"
                          "多以其为「最具特色的年味」。"),
               ("区分要点", "「炸龙」并非富川独有，贵州德江等地亦有同类民俗。"
                          "富川的区分之处在于「上灯 + 炸龙」的组合与古道渊源。"),
               ("需要注意", "级别为自治区级（2014），并非国家级；"
                          "「明代沿古道传入」属地方口碑，正式表述宜作「据传」。")])))

    secs.append(sec("04", "资料来源", "Sources",
        srctable([
            ("名录级别", "A", "2014 年列入广西壮族自治区第五批非物质文化遗产代表性名录，"
             "官方定性为「自治区级」",
             "贺州非遗云展厅（腾讯新闻 2025-02-07）；腾讯新闻 2025-02-06"),
            ("时间", "A", "每年正月初十至十五举行，核心为「上灯祈愿、炸龙狂欢」",
             "富川瑶族自治县文旅局官网"),
            ("起源（存两说）", "C", "「起源于明代万历年间，距今 400 余年」；"
             "另有「相传从我国东南沿着潇贺古道传入富川」之说",
             "广西新闻网 2019-02-15；抖音相关报道"),
            ("上灯仪式细节", "C", "在神楼杀公鸡、鸡血淋神台、焚香烧纸、叩头跪拜、挂上花灯",
             "广西新闻网 2025-02-10"),
            ("「双主角」叙事", "C", "上灯与炸龙是两条线索",
             "网易 2025《灯亮龙腾，烟火生金》"),
            ("扎龙技艺", "A", "自治区级非遗「富川瑶族扎龙技艺」",
             "贺州非遗云展厅"),
            ("现场影像", "C", "中新网 2025-02-13、中国图片网、人民图片网《广西贺州：扎龙迎龙年》",
             "见 <code>images/视觉转化素材库/06-上灯炸龙/</code>"),
            ("存疑说法", "D", "抖音评论「炸龙过气了」（2022）—— 与官方持续报道矛盾，仅供参考",
             "抖音视频 <code>7064740558715014438</code> 评论区"),
        ]),
        "⚠ 上述「存疑说法」出自单条网友评论，证据强度弱，页面仅作留档，不作为事实表述。"))

    return m, secs


def page_panwang():
    m = dict(
        cn="盘王大歌", en="Panwang Da Ge · Yao Epic", key="panwang",
        lead="瑶族史诗，又称《盘王大歌书》《还愿歌》《鼠干歌》《流乐书下卷》，现存歌本约八千行，"
             "现存最早抄本为清乾隆年间；盘王节「还盘王愿」时由师公与歌娘吟唱。"
             "2014 年 11 月经国务院公布，列入第四批国家级非物质文化遗产代表性项目名录（民间文学类），保护主体为江华瑶族自治县文化馆。",
        badges=["国家级非遗 · 2014 第四批", "省级非遗 · 2008 第二批", "歌本约八千行", "三十六歌 · 七任曲"],
        motif="盘王歌印：方印、七分环与抄本页框",
        main="#15120F", accent="#D2A03F", deep="#0A0806", on="#F2EDE2")
    secs = []

    secs.append(sec("01", "这是什么", "What it is",
        """<div class="prose">
        <p>《盘王大歌》，又称《盘王大歌书》《还愿歌》《鼠干歌》《流乐书下卷》，是瑶族的<b>创世与迁徙史诗</b>，
        现存歌本约<b>八千行</b>，现存最早的抄本为<b>清乾隆年间</b>。流传有<b>三十六段、二十四段与十二段</b>三种版本，
        后两种是前一种的摘选本。</p>
        <p>三十六段本包括<b>三十六歌、七曲</b>：记录瑶族的神话、历史、政治、经济、文化艺术与社会生活，
        被当地称为瑶族的「懂宗收」——一部百科全书。<b>湖南江华瑶族自治县是保存《盘王大歌》最丰富的地方。</b></p>
        <p class="soft">名录脉络：2008 年列入湖南省第二批省级非遗名录项目；2014 年 7 月由文化和旅游部公示，
        同年 11 月 11 日经国务院公布（国发〔2014〕59 号），列入<b>第四批国家级非物质文化遗产代表性项目名录</b>（民间文学类）。</p>
        </div>"""))

    secs.append(sec("02", "唱什么 · 怎么唱", "Content and performance",
        """<div class="prose">
        <p><b>唱什么</b>：内容大致七类——神话传说（《盘古歌》《洪水淹天》《葫芦晓》）、
        瑶族迁徙与居住（《十二姓瑶人游天下》《千家峒歌》《过山根》）、生产生活（《放猎狗》）、
        男女之情（数量最多，如《梁山伯》《夜深深》）、历史人物传说（《鲁班造寺》《彭祖歌》）、
        祭祀歌（《送神歌》《庙愿歌》）与自然现象（《天地暗》）。</p>
        <p><b>用什么曲</b>：歌有歌名，曲有曲牌，共 <b>七支「七任曲」</b>——梅花曲、南花子、飞江南、
        相逢贤曲、万段曲、亚六曲、荷叶杯。</p>
        <p><b>在什么场合唱</b>：盘王节「还盘王愿」仪式中演唱。其中「流乐」下卷摆洪沙大席，
        由四位正师公、家主与歌娘一齐<b>吟唱《盘王大歌》</b>，这是盘王节最重要的仪式环节。</p>
        <p><b>怎么唱</b>：用本民族的传统唱腔，<b>男女对唱</b>，抑扬顿挫；有的清唱，有的伴以乐器，
        有的以诵为主，有的又唱又诵。</p>
        </div>
        <div class="grid2" style="margin-top:8px">
          <div class="card"><h3>源流的两处古证</h3>
          <p>晋代干宝《搜神记》记瑶族先民「用糁，杂鱼肉，叩槽而号，以祭盘瓠」；
          唐代刘禹锡《蛮子歌》「时节祠盘瓠」即记「还盘王愿」。瑶族没有文字，
          史诗靠口耳相传——这正是它「有声」的根。</p></div>
          <div class="card"><h3>与其它主题的接口</h3>
          <p>官方原文：与《盘王大歌》一起存在的<b>长鼓及其歌舞</b>，都是构成瑶族灿烂文化艺术不可缺少的部分。
          因此它与「长鼓舞」「蝴蝶歌」「盘王节」本属同一体系，而不是一件孤立的曲目。</p></div>
        </div>"""))

    secs.append(sec("03", "记录 · 与视觉转化", "Records and transformation",
        figs([("约 8000", "行 · 现存歌本", "三十六/二十四/十二段三种版本"),
              ("7", "任曲 · 曲牌", "梅花曲 · 南花子 · 飞江南…"),
              ("2014", "国家级非遗", "第四批 · 民间文学类"),
              ("清乾隆", "最早抄本", "现存抄本年代上限")]) +
        cards([("为什么它占第六席",
                "六题里唯一的「唱出来的史诗」：既补上江华此前零条目的空缺，"
                "又与盘王节、长鼓舞、蝴蝶歌连成瑶族「节—歌—舞—史诗」的完整链条。"),
               ("视觉转化的四个抓手",
                "① 手抄本形制（竖行、歌行、朱印）→ 版式语言；② 七任曲 → 七段式图形序列；"
                "③ 三十六歌 → 可编号的条目系统；④ 男女对唱 → 双线对称构图（可与蝴蝶歌的多声部共用一套语法）。"),
               ("不要做的两件事",
                "不要凭空绘制「盘王像」或编造纹样；本页 hero 纹样是本站转译的盘王信仰印记示意，"
                "已如实标为「转译」而非传统形态。参考图待补：清代手抄本、盘王节现场、七任曲曲谱。")])))

    secs.append(sec("04", "资料来源", "Sources",
        srctable([
            ("名录级别", "A", "2014 年 7 月公示、11 月 11 日经国务院公布（国发〔2014〕59 号），列入第四批国家级非物质文化遗产代表性项目名录（民间文学类）",
             "国务院《关于公布第四批国家级非物质文化遗产代表性项目名录的通知》；湖南省文化和旅游厅《永州江华〈盘王大歌〉——国家级非物质文化遗产》(2019-09)；华声在线 2014-07-18"),
            ("源流古证", "B", "《搜神记》「用糁，杂鱼肉，叩槽而号，以祭盘瓠」；《蛮子歌》「时节祠盘瓠」",
             "干宝《搜神记》卷十四；刘禹锡《蛮子歌》（《刘梦得文集》）"),
            ("省级前身", "A", "2008 年列入湖南省第二批省级非遗名录项目；保护主体为江华瑶族自治县文化馆",
             "江华瑶族自治县人民政府《盘王大歌》(2022-06-30，来源文旅云)"),
            ("歌本与版本", "A", "现存歌本约八千行；最早抄本为清乾隆年间；三十六/二十四/十二段三种版本；三十六段本含三十六歌、七曲",
             "同上"),
            ("演唱形态", "A", "「还盘王愿」之「流乐」下卷由四位正师公、家主与歌娘一齐吟唱；男女对唱；清唱 / 伴乐器 / 以诵为主 / 又唱又诵",
             "同上"),
            ("七任曲曲牌", "A", "梅花曲、南花子、飞江南、相逢贤曲、万段曲、亚六曲、荷叶杯",
             "同上"),
            ("与长鼓舞的接口", "A", "「与《盘王大歌》一起存在的长鼓及其歌舞」为瑶族文化不可缺少的部分",
             "同上"),
            ("手抄本图像", "C", "江华县湘江乡《盘王大歌》清代手抄本图像，可作临摹参考（需注明出处）",
             "湖南省文化和旅游厅 2019-09"),
            ("音视频", "D", "站内收 35 秒选段（《万段曲》，来源 B 站 BV1JUyABpEbb，见本章「声音轨迹」与声音数据库第 Ⅴ 组）；完整演出视频未逐条核验，暂不列为档案",
             "哔哩哔哩；平台检索 2026-10"),
        ]),
        "⚠ 音档只有 35 秒选段（《万段曲》），完整版与现场录音尚未取得；网上能搜到的演出视频未逐条核验，暂不列为档案。"))

    return m, secs


def page_jinzhi():
    m = dict(
        cn="瑶族织锦", en="Yao Brocade", key="brocade",
        plate=("06", "富川平地瑶织锦与服饰", "富川平地瑶聚居区"),
        lead="流传于广西富川瑶族自治县平地瑶居住区的一种传统织锦技艺。以植物染色的经纬线织出几何纹样，"
             "用于被面、枕头、花带、口水围、头帕与服饰。2018 年列入广西壮族自治区级非物质文化遗产代表性项目名录。",
        badges=["自治区级非遗 · 2018", "平地瑶", "植物染色", "经纬显花"],
        motif="富川平地瑶服饰（资料图）。",
        main="#5E3F55", accent="#C08A2E", deep="#3A2735", on="#F2EDE2")
    secs = []

    secs.append(sec("01", "瑶族织锦是什么", "What it is",
        """<div class="prose">
        <p>据《消费日报》2022 年 3 月 9 日报道：<b>「瑶族织锦技艺正是流传在瑶族平地瑶居住区妇女世世代代流传的一种传统技艺，至今已有 1000 余年历史。2018 年，瑶族织锦技艺正式入选广西壮族自治区级非遗名录。」</b></p>
        <p>贺州平地瑶主要分布在富川瑶族自治县的<b>富阳镇、葛坡镇、朝东镇、麦岭镇</b>以及钟山县的两安瑶族乡等地；传统服饰以<b>大边衣、绑腿、球形髻</b>为识别点（袁兴《广西贺州瑶族服饰文化传承中的形态及设计转化》，2023）。</p>
        <p>织锦的用途，据《消费日报》同篇报道：<b>「以前瑶族织锦在瑶族人的生活用品中，主要用在被面、枕头、花带、口水围、头帕、服饰上。」</b>姑娘出嫁时，<b>「挑夫挑着装有嫁妆的红色木箱，色彩艳丽的织锦被绑在木箱上。到男方家后，瑶女还要把自己亲自织的瑶锦被或瑶锦头帕送给男方亲戚，每家送一件作为礼物。」</b></p>
        </div>"""))

    secs.append(sec("02", "织法与纹样", "Weaving and patterns",
        """<div class="prose">
        <p>袁兴（2023）把贺州瑶族服饰纹样分为<b>动物、植物、人物、几何、复合</b>五类；纹样通过<b>二方连续、四方连续</b>等组织方式，形成<b>对称式、中心式、围合式、套嵌式</b>的构图式样。</p>
        <p>同文记瑶族<b>「好五色衣服」</b>，贺州瑶族服饰以<b>青、白、红、黑、黄</b>为主的色彩体系；《消费日报》记富川织锦的特点是<b>「植物染色技艺独特、织锦技艺独特、织锦图案独特」</b>，染料取自南岭山间植物，如柿子液、虎杖、马蓝、艾草、金樱根、薯莨等。</p>
        <p>富川织锦与江华「八宝被」同属瑶锦，但二者不同：八宝被因被面织有<b>犀牛望月、双狮抱球、麒麟送子、丹凤朝阳、金龙出洞、鲤鱼跳龙门</b>等八种吉祥图案而得名；富川织锦不以「八宝」为名。引用时分别写<b>「江华八宝被」</b>与<b>「富川瑶族织锦」</b>。</p>
        </div>
        <div class="grid2" style="margin-top:8px">
          <div class="card"><h3>植物染色</h3><p>《消费日报》记富川织锦以植物染色：采集南岭山间植物熬成染液，放入纱线加温恒温染色，反复多遍；染好的纱线埋在当地泥巴里，三天后取出洗净。染料多为瑶族常用中草药，如柿子液、虎杖、马蓝、艾草、金樱根、薯莨等。</p></div>
          <div class="card"><h3>在服饰上</h3><p>织锦用于被面、枕头、花带、口水围、头帕与服饰；在平地瑶服饰上，它常出现在袖口、围裙、头帕、绑腿等位置。看实物时，既要看正面图案，也要看背面走线与经纬组织。</p></div>
        </div>"""))

    secs.append(sec("03", "分布、用途与传承", "Distribution and transmission",
        figs([("2018", "自治区级非遗", "瑶族织锦技艺（富川）"),
              ("1000+", "年 · 织锦历史", "平地瑶居住区"),
              ("平地瑶", "支系", "富阳／葛坡／朝东／麦岭"),
              ("富川", "县 · 广西贺州", "潇贺古道西线所经")]) +
        cards([("分布", "富川瑶族自治县富阳镇、葛坡镇、朝东镇、麦岭镇，以及钟山县两安瑶族乡等地，是平地瑶的主要分布区。"),
               ("用途", "被面、枕头、花带、口水围、头帕、服饰；姑娘出嫁时作嫁妆，织锦被面绑在嫁妆木箱上，婚后送给男方亲戚。"),
               ("传承", "富川瑶族织锦技艺自治区级代表性传承人李冬梅，掌握平地瑶织锦、刺绣技艺；富川特色瑶绣列入文化和旅游部「潇贺古道 千年乡愁」线路创意产品。")])))

    secs.append(sec("04", "资料来源", "Sources",
        srctable([
            ("名录级别", "A", "2018 年，瑶族织锦技艺正式入选广西壮族自治区级非遗名录",
             "消费日报《千年瑶族织锦技艺“染”出时代风采》(2022-03-09)"),
            ("历史与支系", "A", "流传于平地瑶居住区，至今 1000 余年；富川平地瑶分布在富阳、葛坡、朝东、麦岭及钟山两安",
             "消费日报 2022-03-09；袁兴《广西贺州瑶族服饰文化传承中的形态及设计转化》(2023)"),
            ("纹样分类与构图", "A", "动物、植物、人物、几何、复合五类；二方／四方连续；对称／中心／围合／套嵌四式",
             "袁兴 2023"),
            ("五色", "A", "瑶族「好五色衣服」，贺州瑶族服饰以青、白、红、黑、黄为主",
             "袁兴 2023"),
            ("用途与嫁妆", "A", "被面、枕头、花带、口水围、头帕、服饰；出嫁时织锦被面绑在嫁妆木箱上，送给男方亲戚",
             "消费日报 2022-03-09"),
            ("八宝被（对照）", "A", "江华瑶族织锦俗称八宝被，因被面织有八种吉祥图案而得名",
             "湖南省文化和旅游厅《江华瑶家手工艺品的瑰宝：“八宝被”织锦》(2015-12-01)"),
            ("传承人", "A", "李冬梅，富川瑶族织锦技艺自治区级代表性传承人，平地瑶织锦、刺绣",
             "袁兴 2023"),
            ("本地文创", "A", "富川特色瑶绣列入「潇贺古道 千年乡愁」线路创意产品",
             "文化和旅游部「广西·潇贺古道 千年乡愁」(2024-07-16)"),
        ]),
        ""))

    return m, secs

# ---------------------------------------------------------------- 组装

PAGES = [
    ("02-女书.html", page_nushu),
    ("03-蝴蝶歌.html", page_butterfly),
    ("04-长鼓舞.html", page_drum),
    ("05-风雨桥.html", page_bridge),
    ("06-盘王大歌.html", page_panwang),
    ("07-富川织锦.html", page_jinzhi),
]


def build(name, fn):
    m, secs = fn()
    sources = next((s for s in secs if s.startswith(SOURCE_MARK)), "")
    secs = [s for s in secs if not s.startswith(SOURCE_MARK)]
    chapter = next(c for c in CHAPTERS if c["href"] == name)
    m["key"] = chapter["key"]
    # 用 %%KEY%% 做占位替换：页面里 CSS / SVG 有大量 %，不走 % 格式化。
    subs = {
        "%%CN%%": m["cn"],
        "%%DESC%%": m["lead"][:150].replace('"', "「"),
        "%%MAIN%%": m["main"],
        "%%ACCENT%%": m["accent"],
        "%%DEEP%%": m["deep"],
        "%%ON%%": m.get("on", "#F2EDE2"),
        "%%SURFACE%%": chapter["surface"],
        "%%KEY%%": chapter["key"],
        "%%ARRIVAL_LONG%%": " arrival-title--long" if len(m["cn"]) >= 4 else "",
        "%%SELF%%": name,
        "%%SELFURL%%": SITE + "themes/" + quote(name),
        "%%NAV%%": nav(),
        "%%HERO%%": hero(m, m.get("motif", ""), chapter["num"]),
        "%%PRELUDE%%": "",
        "%%EXTRA_HEAD%%": "",
        "%%EXTRA_SCRIPTS%%": "",
        "%%SECTIONS%%": "\n".join(secs),
        "%%SOUND%%": sound_line(m),
        "%%FOOT%%": foot(name),
        "%%SOURCES%%": source_ledger(sources),
    }
    if name == "02-女书.html":
        subs["%%PRELUDE%%"] = LEXICON
        subs["%%EXTRA_HEAD%%"] = '<link rel="stylesheet" href="assets/nushu-curtain.css">'
        subs["%%EXTRA_SCRIPTS%%"] = (
            '<script src="assets/nushu-dict.js" defer></script>\n'
            '<script src="assets/nushu-curtain.js" defer></script>')
    html = PAGE
    for k, v in subs.items():
        html = html.replace(k, v)
    return html
def main():
    out = HERE
    for name, fn in PAGES:
        html = build(name, fn)
        p = os.path.join(out, name)
        with io.open(p, "w", encoding="utf-8", newline="\n") as f:
            f.write(html)
        print("written", p, len(html), "bytes")


if __name__ == "__main__":
    main()
