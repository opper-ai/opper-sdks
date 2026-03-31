from opperai import Opper

opper = Opper()

# --- docs ---
functions = opper.functions.list()
for fn in functions[:5]:
    print(f"{fn.name} (hits: {fn.hit_count})")
# --- /docs ---
