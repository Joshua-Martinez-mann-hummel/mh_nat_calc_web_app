import xlwings as xw
import pandas as pd
import random
import itertools
import time
import os

# ----------------------------------------------------
# CONFIGURATION
# ----------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WORKBOOK_PATH = os.path.join(SCRIPT_DIR, '..', '..', '..', 'raw_calc.xlsm')
OUTPUT_CSV_PATH = os.path.join(SCRIPT_DIR, "results_panels_excel.csv")

SHEET_NAME = "Panels-Links Calc"

NUM_TESTS_PER_COMBINATION = 50  # Number of random dimension pairs to test per product combination
SECONDS_PER_TEST_CASE = 0.4

DECIMAL_OPTIONS = [0.0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]
HEIGHT_RANGE = (4, 77)
WIDTH_RANGE = (4, 77) # Increased to match the application's max width validation
NUM_PANELS_RANGE = (2, 10)

EXCEL_ERROR_STRINGS = [
    'Contact Customer Service',
    'Standard Part #',
    '#N/A',
    '#VALUE!',
]

# Product-specific validation rules
PRODUCT_MAX_HEIGHTS = {
    "Tri-Dek FC Panel": 24.875,
    "Tri-Dek 3/67 2-Ply": 51.25,
    "Tri-Dek 15/40 3-Ply": 51.25,
    "Tri-Dek 4-ply XL": 51.25,
}

# ----------------------------------------------------
# HELPERS
# ----------------------------------------------------
def get_dropdown_values(ws, cell_address):
    """Return list of dropdown options for a given cell."""
    rng = ws.range(cell_address)
    try:
        validation = rng.api.Validation
        if validation.Type != 3: return []
        formula = validation.Formula1
        if not formula or not str(formula).startswith("="):
            return [item.strip() for item in str(formula).split(",") if item.strip()]
        
        ref = formula[1:]
        if "!" in ref:
            sheet_name, range_ref = ref.split("!", 1)
            sheet_name = sheet_name.strip("'")
            target_ws = ws.book.sheets[sheet_name]
            return [cell.value for cell in target_ws.range(range_ref) if cell.value is not None]
        else:
            named_rng = ws.book.names[ref].refers_to_range
            return [cell.value for cell in named_rng if cell.value is not None]
    except Exception:
        return []

def random_dimension(range_min, range_max):
    whole = random.randint(range_min, range_max)
    decimal = random.choice(DECIMAL_OPTIONS)
    return whole, decimal

def parse_excel_output_value(text_value):
    """
    Parses an Excel output text value. If it's an error string, returns the string.
    Otherwise, attempts to convert to float, returning 0.0 on failure.
    """
    if isinstance(text_value, str):
        if any(err_str.lower() in text_value.lower() for err_str in EXCEL_ERROR_STRINGS) or text_value.startswith('#'):
            return text_value
        
        cleaned_value = text_value.replace('$', '').replace(',', '').strip()
        if cleaned_value == '' or cleaned_value == '-': return 0.0
        try:
            return float(cleaned_value)
        except ValueError:
            return 0.0
    return text_value

# ----------------------------------------------------
# MAIN
# ----------------------------------------------------
def main():
    app = xw.App(visible=False)
    try:
        wb = xw.Book(WORKBOOK_PATH)
        ws = wb.sheets[SHEET_NAME]

        product_families = get_dropdown_values(ws, "E7")
        add_ons = get_dropdown_values(ws, "E9")
        types = get_dropdown_values(ws, "E11")
        is_exact_options = get_dropdown_values(ws, "E14")

        print("📦 Product Families:", product_families)
        print("✨ Add-ons:", add_ons)
        print("🔩 Types:", types)
        print("🎯 Is Exact:", is_exact_options)

        results = []
        test_cases = []

        print("\nGenerating random test cases in-memory...")
        for family, add_on, type, is_exact in itertools.product(product_families, add_ons, types, is_exact_options):
            # Get the product-specific max height, or fall back to the default.
            max_height = PRODUCT_MAX_HEIGHTS.get(family, HEIGHT_RANGE[1])

            for _ in range(NUM_TESTS_PER_COMBINATION):
                # For random dimensions, ensure we don't exceed the max height, even with fractions.
                # We'll use the integer part of the max_height for the random whole number range.
                height_whole, height_dec = random_dimension(HEIGHT_RANGE[0], int(max_height))
                width_whole, width_dec = random_dimension(*WIDTH_RANGE)
                num_panels = random.randint(*NUM_PANELS_RANGE) if type == 'Link' else 1

                # If we hit the max whole number, ensure the fraction doesn't push it over the total max.
                if height_whole == int(max_height) and height_dec > (max_height - int(max_height)):
                    height_dec = 0.0 # Or any valid fraction within the limit

                test_cases.append({
                    "productFamily": family, "addOn": add_on, "type": type, "isExact": is_exact,
                    "numberOfPanels": num_panels,
                    "heightWhole": height_whole, "heightFraction": height_dec,
                    "widthWhole": width_whole, "widthFraction": width_dec,
                })

        print("Generating specific invalid input test cases...")
        invalid_test_cases = [
            # Dimensions too small (should fail for all types)
            {"heightWhole": 2, "heightFraction": 0.5, "widthWhole": 20, "widthFraction": 0.0},
            {"heightWhole": 20, "heightFraction": 0.0, "widthWhole": 2, "widthFraction": 0.5},
            # Dimensions too large (should fail only for isExact = 'Yes')
            {"heightWhole": 52, "heightFraction": 0.0, "widthWhole": 40, "widthFraction": 0.0}, # Over height
            {"heightWhole": 40, "heightFraction": 0.0, "widthWhole": 78, "widthFraction": 0.0}, # Over width
        ]

        # Add invalid cases for each product family and type, specifically for 'isExact' = 'Yes'
        for family in product_families:
            for type in types:
                for invalid_case in invalid_test_cases:
                    test_cases.append({
                        "productFamily": family,
                        "addOn": "None (Standard)", # Use a standard add-on for these checks
                        "type": type,
                        "isExact": "Yes", # These validations apply to Exact parts
                        "numberOfPanels": 2 if type == 'Link' else 1,
                        "heightWhole": invalid_case["heightWhole"], "heightFraction": invalid_case["heightFraction"],
                        "widthWhole": invalid_case["widthWhole"], "widthFraction": invalid_case["widthFraction"],
                    })


        print(f"Generated {len(test_cases)} total test cases.")

        total_seconds = len(test_cases) * SECONDS_PER_TEST_CASE
        estimated_minutes = total_seconds / 60
        print(f"Estimated time to process in Excel: {estimated_minutes:.2f} minutes.")
        print("Processing test cases in Excel...")

        for i, case in enumerate(test_cases):
            print(f"  Processing case {i+1}/{len(test_cases)} for '{case['productFamily']}'...", end='\r')
            
            # Populate Inputs
            ws["E7"].value = case["productFamily"]
            ws["E9"].value = case["addOn"]
            ws["E11"].value = case["type"]
            if case["type"] == 'Link':
                ws["E12"].value = case["numberOfPanels"]
            ws["E14"].value = case["isExact"]
            ws["E17"].value = case["heightWhole"]
            ws["F17"].value = case["heightFraction"]
            ws["E18"].value = case["widthWhole"]
            ws["F18"].value = case["widthFraction"]

            wb.app.calculate()
            time.sleep(0.1)

            # Read Outputs
            try:
                range_of_link_width = ws["E19"].api.Text
                part_number = ws["E23"].api.Text
                price_text = ws["E25"].api.Text
                carton_qty_text = ws["E27"].api.Text
                carton_price_text = ws["E28"].api.Text
                
                price = parse_excel_output_value(price_text)
                carton_qty = parse_excel_output_value(carton_qty_text)
                carton_price = parse_excel_output_value(carton_price_text)
                
            except Exception as e:
                print(f"\n   [DEBUG] Error reading text: {e}. Falling back to .value")
                range_of_link_width = ws["E19"].value or ""
                part_number = ws["E23"].value or ""
                price = parse_excel_output_value(ws["E25"].value)
                carton_qty = parse_excel_output_value(ws["E27"].value)
                carton_price = parse_excel_output_value(ws["E28"].value)

            # Ensure we don't write NaN values to the CSV.
            if isinstance(price, (int, float)): price = 0 if pd.isna(price) else price
            if isinstance(carton_qty, (int, float)): carton_qty = 0 if pd.isna(carton_qty) else carton_qty
            if isinstance(carton_price, (int, float)): carton_price = 0 if pd.isna(carton_price) else carton_price

            # Append all inputs and outputs for a complete record
            result_row = case.copy()
            result_row.update({
                "rangeOfLinkWidth": range_of_link_width,
                "partNumber": part_number,
                "price": price,
                "cartonQty": carton_qty,
                "cartonPrice": carton_price,
            })
            results.append(result_row)

        df = pd.DataFrame(results)
        
        # Reorder columns for clarity
        input_cols = list(test_cases[0].keys())
        output_cols = ["rangeOfLinkWidth", "partNumber", "price", "cartonQty", "cartonPrice"]
        df = df[input_cols + output_cols]

        df.to_csv(OUTPUT_CSV_PATH, index=False)
        print(f"\n✅ Test results saved to {OUTPUT_CSV_PATH}")

    finally:
        if 'wb' in locals(): wb.close()
        app.quit()
        print("\n")

if __name__ == "__main__":
    main()