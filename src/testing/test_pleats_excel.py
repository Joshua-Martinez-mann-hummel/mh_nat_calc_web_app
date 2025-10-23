import xlwings as xw
import pandas as pd
import random
import time
import os

# ----------------------------------------------------
# CONFIGURATION
# ----------------------------------------------------

# --- Use paths relative to this script's location ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WORKBOOK_PATH = os.path.join(SCRIPT_DIR, '..', '..', 'raw_calc.xlsm') # Go up two directories
OUTPUT_CSV_PATH = os.path.join(SCRIPT_DIR, "results_pleats_excel.csv")

SHEET_NAME = "Pleats Calc"

NUM_TESTS_PER_FAMILY = 10

DECIMAL_OPTIONS = [0.0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]
WIDTH_RANGE = (6, 36)
LENGTH_RANGE = (6, 72)


# ----------------------------------------------------
# HELPERS
# ----------------------------------------------------
def get_dropdown_values(ws, cell_address):
    """Return list of dropdown options for a given cell (even across sheets)."""
    rng = ws.range(cell_address)
    try:
        validation = rng.api.Validation
    except Exception:
        return []

    try:
        if validation.Type != 3:  # 3 = xlValidateList
            return []
    except Exception:
        return []

    formula = validation.Formula1

    # Case 1: Inline comma-separated list ("Yes,No")
    if not formula or not str(formula).startswith("="):
        return [item.strip() for item in str(formula).split(",") if item.strip()]

    # Case 2: Range reference (e.g., ='Sheet2'!$A$1:$A$5)
    ref = formula[1:]  # remove leading '='

    # Parse out the sheet name and range
    if "!" in ref:
        sheet_name, range_ref = ref.split("!", 1)
        sheet_name = sheet_name.strip("'")  # remove quotes if any
        try:
            target_ws = ws.book.sheets[sheet_name]
            target_rng = target_ws.range(range_ref)
            values = [cell.value for cell in target_rng if cell.value is not None]
            return values
        except Exception as e:
            print(f"⚠️ Could not read range {ref}: {e}")
            return []

    # Case 3: Named range
    try:
        named = ws.book.names[ref]
        named_rng = named.refers_to_range
        if named_rng is not None:
            return [cell.value for cell in named_rng if cell.value is not None]
        else:
            # fallback: try evaluating
            vals = ws.book.app.evaluate(ref)
            flat = []
            if vals is None:
                return []
            if isinstance(vals, (tuple, list)):
                for row in vals:
                    for v in row:
                        if v is not None:
                            flat.append(v)
            else:
                flat = [vals]
            return flat
    except Exception as e:
        print(f"⚠️ Could not resolve named range {ref}: {e}")
        return []


def random_dimension(range_min, range_max):
    whole = random.randint(range_min, range_max)
    decimal = random.choice(DECIMAL_OPTIONS)
    return whole, decimal


# ----------------------------------------------------
# MAIN
# ----------------------------------------------------
def main():
    app = xw.App(visible=False)
    wb = xw.Book(WORKBOOK_PATH)
    ws = wb.sheets[SHEET_NAME]

    # Automatically detect dropdown lists
    product_families = get_dropdown_values(ws, "F7")
    depth_options = get_dropdown_values(ws, "F15")
    made_exact_options = get_dropdown_values(ws, "G13")

    print("📦 Product Families:", product_families)
    print("📏 Depth Options:", depth_options)
    print(f"   [DEBUG] Initial depth option types: {[type(o) for o in depth_options]}")
    print("🎯 Will-Be-Made-Exact Options:", made_exact_options)

    results = []

    for i, family in enumerate(product_families):
        print(f"\nRunning tests for Product Family: {family}")

        for _ in range(NUM_TESTS_PER_FAMILY):
            width_whole, width_dec = random_dimension(*WIDTH_RANGE)
            length_whole, length_dec = random_dimension(*LENGTH_RANGE)
            will_be_exact = random.choice(made_exact_options)

            # Set the product family in Excel to update dependent dropdowns
            ws["F7"].value = family
            
            # For the first two families, only test depths 1 and 2.
            if i < 2:
                depth = random.choice([1, 2])
            else:
                # For all other families, get the available depth options from Excel, preserving their type.
                depth_options = [v for v in get_dropdown_values(ws, "F15") if v not in (None, "")]
                print(f"   [DEBUG] Dependent depth options for '{family}': {depth_options} (types: {[type(o) for o in depth_options]})")
                # CRITICAL: Do NOT convert the type. The Excel formulas expect the exact type (e.g., text '4') from the dropdown source.
                depth = random.choice(depth_options)

            # --- Additional Debugging ---
            try:
                print(f"   [DEBUG] F15 (Depth) dropdown validation formula: {ws.range('F15').api.Validation.Formula1}")
            except Exception:
                print("   [DEBUG] Could not read F15 validation formula.")

            # Populate Inputs
            ws["F10"].value = width_whole
            ws["G10"].value = width_dec
            ws["F11"].value = length_whole
            ws["G11"].value = length_dec
            ws["G13"].value = str(will_be_exact)

            # Set the depth value, preserving its original type (e.g., text '4')
            # The formulas in the sheet depend on this exact type.
            print(f"   [DEBUG] Setting depth to: {depth} (type: {type(depth)})")
            # If the depth is a string that looks like a number (e.g., '4'),
            # we prepend an apostrophe to force Excel to treat it as text.
            # This prevents auto-conversion to a number, which breaks the formulas.
            if isinstance(depth, str) and depth.isnumeric():
                ws["F15"].value = f"'{depth}"
            else:
                ws["F15"].value = depth

            # Force Excel recalculation and wait for it to complete
            ws.book.app.calculate()
            ws.book.app.calculation = 'automatic'  # Ensure automatic calc is on
            time.sleep(0.5)  # Wait half a second for Excel to finish

            # Read Outputs - get the DISPLAYED text, not the formula value
            try:
                # Try to get the displayed text (what you see visually)
                part_number = ws["F19"].api.Text
                price_text = ws["F21"].api.Text
                carton_qty_text = ws["F23"].api.Text
                carton_price_text = ws["F24"].api.Text
                
                print(f"   [DEBUG] Text values: Part#='{part_number}', Price='{price_text}', Qty='{carton_qty_text}', CartonPrice='{carton_price_text}'")
                
                # Convert to proper types
                try:
                    price = float(price_text.replace('$', '').replace(',', '')) if price_text and price_text != '' else 0
                except:
                    price = 0
                
                try:
                    carton_qty = float(carton_qty_text.replace(',', '')) if carton_qty_text and carton_qty_text != '' else 0
                except:
                    carton_qty = 0
                    
                try:
                    carton_price = float(carton_price_text.replace('$', '').replace(',', '')) if carton_price_text and carton_price_text != '' else 0
                except:
                    carton_price = 0
                
            except Exception as e:
                print(f"   [DEBUG] Error reading text: {e}")
                # Last resort fallback
                part_number = ws["F19"].value
                price = ws["F21"].value if ws["F21"].value else 0
                carton_qty = ws["F23"].value if ws["F23"].value else 0
                carton_price = ws["F24"].value if ws["F24"].value else 0

            print(f"   [DEBUG] Final values: Part#='{part_number}', Price={price}, Qty={carton_qty}, CartonPrice={carton_price}")

            # Safety check for Excel errors before appending results
            # We check for standard Excel errors (e.g., #N/A) and custom text errors.
            is_error = False
            for val in [part_number, price, carton_qty, carton_price]:
                if isinstance(val, str) and (val.startswith('#') or 'Contact' in val):
                    is_error = True
                    print(f"⚠️  Excel error or 'Contact' message detected: '{val}' for {family} | Depth: {depth}. Skipping result.")
                    break # No need to check other values
            if is_error: continue
            
            # Ensure we don't write NaN values to the CSV, which can cause errors
            price = 0 if pd.isna(price) else price
            carton_qty = 0 if pd.isna(carton_qty) else carton_qty
            carton_price = 0 if pd.isna(carton_price) else carton_price


            results.append({
                "Product_Family": family,
                "Width": width_whole + width_dec,
                "Length": length_whole + length_dec,
                "Exact": will_be_exact,
                "Depth": depth,
                "Part_Number": part_number,
                "Price": price,
                "Carton_Quantity": carton_qty,
                "Carton_Price": carton_price
            })

    df = pd.DataFrame(results)
    df.to_csv(OUTPUT_CSV_PATH, index=False)
    print(f"\n✅ Test results saved to {OUTPUT_CSV_PATH}")

    wb.close()
    app.quit()


if __name__ == "__main__":
    main()
