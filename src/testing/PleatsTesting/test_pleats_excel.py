import xlwings as xw
import pandas as pd
import random
import itertools
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

NUM_TESTS_PER_COMBINATION = 10 # Number of random (Width, Length) whole number pairs to test per product family
SECONDS_PER_TEST_CASE = 0.5 # Rough estimate for Excel operations + sleep per test case

DECIMAL_OPTIONS = [0.0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]
WIDTH_RANGE = (6, 36)
LENGTH_RANGE = (6, 72)

EXCEL_ERROR_STRINGS = [
    'Contact Customer Service',
    'Dimensions out of range',
    '#N/A', # Standard Excel error
    '#VALUE!', # Another standard Excel error
    '#DIV/0!', # Another standard Excel error
    '#REF!', # Another standard Excel error
    '#NAME?', # Another standard Excel error
    '#NUM!', # Another standard Excel error
    '#NULL!' # Another standard Excel error
]

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
        except Exception:
            # print(f"⚠️ Could not read range {formula[1:]}: {e}") # Debugging only
            return []

    # Case 3: Named range
    try: # Corrected: use formula[1:]
        named = ws.book.names[formula[1:]]
        named_rng = named.refers_to_range
        if named_rng is not None:
            return [cell.value for cell in named_rng if cell.value is not None]
        else:
            # fallback: try evaluating
            vals = ws.book.app.evaluate(ref)
            flat = []
            if vals is not None: # Ensure vals is not None before iterating
                if isinstance(vals, (tuple, list)):
                    for row in vals:
                        # Ensure row is iterable, in case it's a single value
                        if not isinstance(row, (tuple, list)):
                            row = [row]
                        for v in row:
                            if v is not None:
                                flat.append(v)
                else:
                    flat = [vals]
            return flat
    except Exception:
        # print(f"⚠️ Could not resolve named range {formula[1:]}: {e}") # Debugging only
        return []


def random_dimension(range_min, range_max):
    whole = random.randint(range_min, range_max)
    decimal = random.choice(DECIMAL_OPTIONS)
    return whole, decimal

def parse_excel_output_value(text_value):
    """
    Parses an Excel output text value.
    If it's an error string, returns the string.
    Otherwise, attempts to convert to float, returning 0.0 on failure.
    """
    if isinstance(text_value, str):
        # Check for known error strings or Excel error codes (case-insensitive for "Contact Customer Service")
        if any(err_str.lower() in text_value.lower() for err_str in EXCEL_ERROR_STRINGS) or text_value.startswith('#'):
            return text_value # Keep error string as is
        
        # Attempt to convert to float
        cleaned_value = text_value.replace('$', '').replace(',', '').strip()
        if cleaned_value == '':
            return 0.0
        try:
            return float(cleaned_value)
        except ValueError:
            return 0.0 # Not a recognized error string, but still not a number
    return text_value # Return as is if not a string (e.g., already a number)


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
    test_cases = []

    print("\nGenerating test cases in-memory...")
    # Create all random test cases first
    for i, family in enumerate(product_families):
        # Set the product family once to get its dependent dropdowns
        ws["F7"].value = family
        time.sleep(0.1) # A small pause might be needed for Excel to update dependent validation
        
        # For the first two families, only test depths 1 and 2.
        if i < 2:
            available_depths = [1, 2]
        else:
            available_depths = [v for v in get_dropdown_values(ws, "F15") if v not in (None, "")]

        # Systematically create combinations for every depth and exact status.
        # For each of those combinations, generate a number of tests with random dimensions.
        for depth, exact in itertools.product(available_depths, made_exact_options):
            for _ in range(NUM_TESTS_PER_COMBINATION):
                width_whole, width_dec = random_dimension(*WIDTH_RANGE)
                length_whole, length_dec = random_dimension(*LENGTH_RANGE)
                test_cases.append({
                    "family": family,
                    "width_whole": width_whole, "width_dec": width_dec, "length_whole": length_whole, "length_dec": length_dec,
                    "exact": exact,
                    "depth": depth
                })
    print(f"Generated {len(test_cases)} total test cases.")

    # Calculate and print estimated time
    total_seconds = len(test_cases) * SECONDS_PER_TEST_CASE
    estimated_minutes = total_seconds / 60
    print(f"Estimated time to process in Excel: {estimated_minutes:.2f} minutes.")
    print("Processing test cases in Excel...")

    # Now, iterate through the generated test cases and get results from Excel
    for i, case in enumerate(test_cases):
        print(f"  Processing case {i+1}/{len(test_cases)} for family '{case['family']}'...", end='\r')
        
        # Populate Inputs
        ws["F7"].value = case["family"]
        ws["F10"].value = case["width_whole"]
        ws["G10"].value = case["width_dec"]
        ws["F11"].value = case["length_whole"]
        ws["G11"].value = case["length_dec"]
        ws["G13"].value = str(case["exact"])

        depth_val = case["depth"]
        if isinstance(depth_val, str) and depth_val.isnumeric():
            ws["F15"].value = f"'{depth_val}"
        else:
            ws["F15"].value = depth_val

        # Force Excel recalculation. Using app.calculate() is more reliable.
        # The sleep is a fallback for very slow/complex sheets.
        wb.app.calculate()
        time.sleep(0.1) # Reduced sleep, as bulk calculation is often faster.

        # Read Outputs - get the DISPLAYED text, not the formula value
        try:
            part_number = ws["F19"].api.Text
            price_text = ws["F21"].api.Text
            carton_qty_text = ws["F23"].api.Text
            carton_price_text = ws["F24"].api.Text
            
            price = parse_excel_output_value(price_text)
            carton_qty = parse_excel_output_value(carton_qty_text)
            carton_price = parse_excel_output_value(carton_price_text)
            
        except Exception as e:
            print(f"\n   [DEBUG] Error reading text: {e}. Falling back to .value")
            # Fallback to .value if .api.Text fails, but still parse them
            part_number = ws["F19"].value
            price = parse_excel_output_value(ws["F21"].value)
            carton_qty = parse_excel_output_value(ws["F23"].value)
            carton_price = parse_excel_output_value(ws["F24"].value)

        # Check if any of the *parsed* values are strings (meaning they were error messages)
        if any(isinstance(val, str) for val in [price, carton_qty, carton_price]):
            print(f"\n✅  Found 'Contact'/'Error' case for {case['family']} | Depth: {case['depth']}. Including in results.")

        # Ensure we don't write NaN values to the CSV.
        # This will only affect numeric values. String error messages will remain as strings.
        if isinstance(price, (int, float)):
            price = 0 if pd.isna(price) else price
        if isinstance(carton_qty, (int, float)):
            carton_qty = 0 if pd.isna(carton_qty) else carton_qty
        if isinstance(carton_price, (int, float)):
            carton_price = 0 if pd.isna(carton_price) else carton_price

        results.append({
            "Product_Family": case["family"],
            "Width": case["width_whole"] + case["width_dec"],
            "Length": case["length_whole"] + case["length_dec"],
            "Exact": case["exact"],
            "Depth": case["depth"],
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
    print("\n") # Newline after the progress indicator


if __name__ == "__main__":
    main()
