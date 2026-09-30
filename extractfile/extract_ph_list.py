import io
import sys
import csv
import gzip
import requests
import pandas as pd

# Increase CSV field size limit to prevent "field larger than field limit" errors
max_int = sys.maxsize
while True:
    try:
        csv.field_size_limit(max_int)
        break
    except OverflowError:
        max_int = int(max_int / 10)

# Open Food Facts daily compressed CSV dump
CSV_URL = "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz"
OUTPUT_FILE = "philippines_products_master.xlsx"

print("Connecting to Open Food Facts live stream...")
print("Extracting Philippine products (prefix 480 or tagged 'philippines')...")

headers = {
    "User-Agent": "ShadowApolloPOS - PythonExtractor/1.0"
}

# Stream download to avoid saving a 9GB uncompressed file to your hard drive
response = requests.get(CSV_URL, headers=headers, stream=True)
response.raise_for_status()

# Wrap gzip decompressor over raw response stream
gzip_stream = gzip.GzipFile(fileobj=response.raw)
text_stream = io.TextIOWrapper(gzip_stream, encoding="utf-8", errors="replace")

reader = csv.DictReader(text_stream, delimiter="\t")

products = []
categories_set = set()
count = 0

try:
    for row in reader:
        count += 1
        if count % 100000 == 0:
            print(f"Scanned {count:,} items... Found {len(products)} Philippine products so far.")

        barcode = (row.get("code") or "").strip()
        name = (row.get("product_name") or row.get("product_name_en") or "").strip()
        countries = (row.get("countries_tags") or row.get("countries") or "").lower()

        # Check if barcode belongs to Philippines or product is sold in PH
        is_ph = "philippines" in countries or barcode.startswith("480")

        # Keep only valid numeric barcodes and items with names
        if is_ph and barcode and name and barcode.isdigit():
            # Get primary category
            raw_category = (row.get("categories") or "General Grocery").split(",")[0].strip()
            # Clean off any language prefix like "en:"
            category = raw_category.split(":")[-1].replace("-", " ").title() if ":" in raw_category else raw_category.title()
            
            if not category:
                category = "General Grocery"
                
            categories_set.add(category)

            brand = (row.get("brands") or "").strip()
            description = f"{brand} - {name}" if brand else name

            products.append({
                "Barcode": barcode,
                "Product Name": name,
                "Description": description,
                "Price": 20.00,        # Default retail base price
                "Cost Price": 16.00,   # Default cost price
                "Retail Price": 20.00, # Default selling price
                "Tax Rate": 12,        # 12% PH VAT
                "Tax Inclusive": "Yes",
                "Stock Quantity": 24,  # Initial stock count
                "Category Name": category,
                "Serial Numbers": ""
            })

except KeyboardInterrupt:
    print("\nProcess stopped by user. Saving currently extracted products...")
except Exception as e:
    print(f"\nStream ended or encountered an error: {e}")
    print("Saving currently extracted products...")

print(f"\nExtraction completed! Total Philippine products found: {len(products)}")

if products:
    print(f"Building Excel file: {OUTPUT_FILE}...")
    
    # Create DataFrames
    categories_df = pd.DataFrame({"Category Name": sorted(list(categories_set))})
    products_df = pd.DataFrame(products)

    # Save to dual-sheet Excel file matching Shadow Apollo specifications
    with pd.ExcelWriter(OUTPUT_FILE, engine="openpyxl") as writer:
        categories_df.to_excel(writer, sheet_name="Categories", index=False)
        products_df.to_excel(writer, sheet_name="Products", index=False)

    print(f"SUCCESS: Saved {len(products)} products to '{OUTPUT_FILE}'.")
    print("You can now open this file in Excel, edit your prices, and upload it via 'Import Excel' in your POS.")
else:
    print("No matching products found.")