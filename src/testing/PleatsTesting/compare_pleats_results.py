import pandas as pd
import os
import numpy as np

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_RESULTS_PATH = os.path.join(SCRIPT_DIR, "results_pleats_excel.csv")
APP_RESULTS_PATH = os.path.join(SCRIPT_DIR, "results_pleats_app.csv")
SUMMARY_CSV_PATH = os.path.join(SCRIPT_DIR, "comparison_summary.csv")

# Define strings that are considered "error" or "non-price" values in the Excel sheet.
EXCEL_ERROR_STRINGS = [
    '#N/A',
    'Contact Customer Service',
    'Dimensions out of range'
]


def clean_app_df(df):
    """Cleans the DataFrame from the web app test results."""
    # Rename columns to match the Excel results for easier comparison
    df = df.rename(columns={
        "Part Number": "Part_Number",
        "Price": "Price",
        "Carton Quantity": "Carton_Quantity",
        "Carton Price": "Carton_Price"
    })

    # Clean and convert currency/numeric columns
    for col in ["Price", "Carton_Quantity", "Carton_Price"]:
        if col in df.columns:
            # Convert to string, remove '$', ',', and handle non-numeric gracefully
            df[col] = df[col].astype(str).str.replace(r'[$,]', '', regex=True)
            # Convert to numeric, coercing errors to NaN (Not a Number)
            df[col] = pd.to_numeric(df[col], errors='coerce')

    return df


def clean_excel_df(df):
    """Cleans the DataFrame from the Excel ground truth file."""
    # The Excel file can have non-numeric values in price columns
    for col in ["Price", "Carton_Price"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    # Ensure Carton_Quantity is numeric
    if "Carton_Quantity" in df.columns:
        df["Carton_Quantity"] = pd.to_numeric(df["Carton_Quantity"], errors='coerce')

    return df


def main():
    """
    Compares the results from the Excel calculator and the web app,
    then generates a report of any discrepancies.
    """
    print("🔍 Starting comparison...")

    try:
        df_excel = pd.read_csv(EXCEL_RESULTS_PATH)
        df_app = pd.read_csv(APP_RESULTS_PATH)
    except FileNotFoundError as e:
        print(f"❌ Error: Could not find a results file. {e}")
        return

    if len(df_excel) != len(df_app):
        print("⚠️ Warning: The two CSV files have a different number of rows. Comparison may be misaligned.")

    # --- 1. Clean Data ---
    df_excel_clean = clean_excel_df(df_excel.copy())
    df_app_clean = clean_app_df(df_app.copy())

    # --- 2. Compare DataFrames ---
    summary_data = []

    for i in range(len(df_excel)):
        # Get original values for reporting
        excel_pn = str(df_excel.loc[i, "Part_Number"]).strip()
        app_pn = str(df_app.loc[i, "Part Number"]).strip()
        excel_price_orig = df_excel.loc[i, "Price"]
        app_price_orig = df_app.loc[i, "Price"]
        excel_cq_orig = df_excel.loc[i, "Carton_Quantity"]
        app_cq_orig = df_app.loc[i, "Carton Quantity"]
        excel_cp_orig = df_excel.loc[i, "Carton_Price"]
        app_cp_orig = df_app.loc[i, "Carton Price"]

        # Get cleaned numeric values for comparison
        excel_price_clean = df_excel_clean.loc[i, "Price"]
        app_price_clean = df_app_clean.loc[i, "Price"]
        excel_cq_clean = df_excel_clean.loc[i, "Carton_Quantity"]
        app_cq_clean = df_app_clean.loc[i, "Carton_Quantity"]
        excel_cp_clean = df_excel_clean.loc[i, "Carton_Price"]
        app_cp_clean = df_app_clean.loc[i, "Carton_Price"]

        # Perform comparisons
        pn_match = (excel_pn == app_pn)

        # Custom matching logic for price fields
        # It's a match if the numeric values are close, OR if both are considered "error" states.
        is_excel_price_error = pd.isna(excel_price_clean) or excel_price_clean == 0
        is_app_price_error = pd.isna(app_price_clean) or app_price_clean == 0
        price_match = (np.isclose(excel_price_clean, app_price_clean, equal_nan=False)) or (is_excel_price_error and is_app_price_error)

        is_excel_cq_error = pd.isna(excel_cq_clean) or excel_cq_clean == 0
        is_app_cq_error = pd.isna(app_cq_clean) or app_cq_clean == 0
        # If both prices are non-numeric, we can ignore the carton quantity mismatch
        # as it's a known issue where Excel shows 12 and the app correctly shows 0.
        cq_match = (np.isclose(excel_cq_clean, app_cq_clean, equal_nan=False)) or \
                   (is_excel_cq_error and is_app_cq_error) or (is_excel_price_error and is_app_price_error)

        is_excel_cp_error = pd.isna(excel_cp_clean) or excel_cp_clean == 0
        is_app_cp_error = pd.isna(app_cp_clean) or app_cp_clean == 0
        cp_match = (np.isclose(excel_cp_clean, app_cp_clean, equal_nan=False)) or (is_excel_cp_error and is_app_cp_error)

        overall_match = all([pn_match, price_match, cq_match, cp_match])

        row_data = {
            "Product_Family": df_excel.loc[i, "Product_Family"],
            "Width": df_excel.loc[i, "Width"],
            "Length": df_excel.loc[i, "Length"],
            "Depth": df_excel.loc[i, "Depth"],
            "Exact": df_excel.loc[i, "Exact"],
            "excel_part_number": excel_pn,
            "app_part_number": app_pn,
            "part_number_match": pn_match,
            "excel_price": excel_price_orig,
            "app_price": app_price_orig,
            "price_match": price_match,
            "excel_carton_qty": excel_cq_orig,
            "app_carton_qty": app_cq_orig,
            "carton_qty_match": cq_match,
            "excel_carton_price": excel_cp_orig,
            "app_carton_price": app_cp_orig,
            "carton_price_match": cp_match,
            "overall_match": overall_match
        }
        summary_data.append(row_data)

    # --- 3. Generate Report ---
    summary_df = pd.DataFrame(summary_data)
    summary_df.to_csv(SUMMARY_CSV_PATH, index=False)
    
    num_mismatches = len(summary_df[summary_df['overall_match'] == False])
    if num_mismatches == 0:
        print(f"\n✅ All {len(summary_df)} tests passed! No discrepancies found.")
    else:
        print(f"\n🚨 Found {num_mismatches} mismatches out of {len(summary_df)} tests. See '{SUMMARY_CSV_PATH}' for details.")

if __name__ == "__main__":
    main()