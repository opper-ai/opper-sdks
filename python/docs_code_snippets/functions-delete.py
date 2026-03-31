import time
from opperai import Opper

opper = Opper()

# Setup: create function via call
fn_name = f"docs-snippet-{int(time.time())}"
opper.call(fn_name, input="hello")

# --- docs ---
opper.functions.delete(fn_name)
# --- /docs ---
