import io

p = "index.html"
s = io.open(p, encoding="utf-8").read()

s = s.replace("      const cap = 5.2;", "      const cap = 11;")
s = s.replace("      f.vx = g.tx*1.8;\n      f.vy = g.ty*1.8;", "      f.vx = g.tx*3.6;\n      f.vy = g.ty*3.6;")
s = s.replace("    f.s += 1.1;", "    f.s += 2.2;")
s = s.replace("  const BURST_P0 = 0.16, BURST_P1 = 0.60;", "  const BURST_P0 = 0.08, BURST_P1 = 0.34;")

# 弹簧也调硬一点，起步更猛
s = s.replace("      f.vx = f.vx*0.94 + dx*0.020*k;", "      f.vx = f.vx*0.94 + dx*0.055*k;")
s = s.replace("      f.vy = f.vy*0.94 + dy*0.020*k;", "      f.vy = f.vy*0.94 + dy*0.055*k;")

io.open(p, "w", encoding="utf-8", newline="\n").write(s)
print("ok", "cap = 11" in s, "0.055*k" in s)
