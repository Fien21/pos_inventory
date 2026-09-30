import io
import sys
import csv
import gzip
import pandas as pd
import os

# Increase CSV field size limit
max_int = sys.maxsize
while True:
    try:
        csv.field_size_limit(max_int)
        break
    except OverflowError:
        max_int = int(max_int / 10)

# Local file path instead of streaming
LOCAL_CSV_GZ = "en.openfoodfacts.org.products.csv.gz"
OUTPUT_FILE = "philippines_products_master.xlsx"

if not os.path.exists(LOCAL_CSV_GZ):
    print(f"Error: Could not find '{LOCAL_CSV_GZ}' in the current folder.")
    print("Please download it from: https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz")
    print("And place it in this folder, then run this script again.")
    sys.exit(1)

print(f"Reading from local file: {LOCAL_CSV_GZ}...")
print("Extracting Philippine products (prefix 480 or tagged 'philippines')...")

products = []
categories_set = set()
count = 0

try:
    with gzip.open(LOCAL_CSV_GZ, 'rt', encoding="utf-8", errors="replace") as text_stream:
        reader = csv.DictReader(text_stream, delimiter="\t")
        
        for row in reader:
            count += 1
            if count % 100000 == 0:
                print(f"Scanned {count:,} items... Found {len(products)} Philippine products so far.")

            barcode = (row.get("code") or "").strip()
            name = (row.get("product_name") or row.get("product_name_en") or "").strip()
            countries = (row.get("countries_tags") or row.get("countries") or "").lower()

            is_ph = "philippines" in countries or barcode.startswith("480")

            if is_ph and barcode and name and barcode.isdigit():
                raw_category = (row.get("categories") or "General Grocery").split(",")[0].strip()
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
                    "Price": 20.00,
                    "Cost Price": 16.00,
                    "Retail Price": 20.00,
                    "Tax Rate": 12,
                    "Tax Inclusive": "Yes",
                    "Stock Quantity": 24,
                    "Category Name": category,
                    "Serial Numbers": ""
                })

except KeyboardInterrupt:
    print("\nProcess stopped by user. Saving currently extracted products...")
except Exception as e:
    print(f"\nEncountered an error: {e}")
    print("Saving currently extracted products...")

print(f"\nExtraction completed! Total Philippine products found: {len(products)}")

if products:
    print(f"Building Excel file: {OUTPUT_FILE}...")
    categories_df = pd.DataFrame({"Category Name": sorted(list(categories_set))})
    products_df = pd.DataFrame(products)

    with pd.ExcelWriter(OUTPUT_FILE, engine="openpyxl") as writer:
        categories_df.to_excel(writer, sheet_name="Categories", index=False)
        products_df.to_excel(writer, sheet_name="Products", index=False)

    print(f"SUCCESS: Saved {len(products)} products to '{OUTPUT_FILE}'.")
else:
    print("No matching products found.")
