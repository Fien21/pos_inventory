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
OUTPUT_PREFIX = "worldwide_products_part"

print("Connecting to Open Food Facts live stream...")
print("Extracting ALL worldwide products...")

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
file_part = 1
CHUNK_SIZE = 500000  # Save every 500k to avoid Excel's 1 million row limit and manage memory

def save_chunk(part, products_chunk, categories_chunk):
    output_file = f"{OUTPUT_PREFIX}_{part}.xlsx"
    print(f"\nBuilding Excel file: {output_file}...")
    categories_df = pd.DataFrame({"Category Name": sorted(list(categories_chunk))})
    products_df = pd.DataFrame(products_chunk)
    
    # Save to dual-sheet Excel file matching Shadow Apollo specifications
    with pd.ExcelWriter(output_file, engine="openpyxl") as writer:
        categories_df.to_excel(writer, sheet_name="Categories", index=False)
        products_df.to_excel(writer, sheet_name="Products", index=False)
    print(f"SUCCESS: Saved {len(products_chunk)} products to '{output_file}'.")

try:
    for row in reader:
        count += 1
        if count % 100000 == 0:
            print(f"Scanned {count:,} items... Collected {len(products)} products in current chunk.")

        barcode = (row.get("code") or "").strip()
        name = (row.get("product_name") or row.get("product_name_en") or "").strip()

        # Keep only valid numeric barcodes and items with names
        if barcode and name and barcode.isdigit():
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
                "Tax Rate": 0,         # Worldwide might have different taxes
                "Tax Inclusive": "Yes",
                "Stock Quantity": 24,  # Initial stock count
                "Category Name": category,
                "Serial Numbers": ""
            })

            # Save in chunks to manage memory and Excel row limits
            if len(products) >= CHUNK_SIZE:
                save_chunk(file_part, products, categories_set)
                file_part += 1
                products = []  # clear list for next chunk
                categories_set = set() # clear categories for next chunk

except KeyboardInterrupt:
    print("\nProcess stopped by user. Saving currently extracted products...")
except Exception as e:
    print(f"\nStream ended or encountered an error: {e}")
    print("Saving currently extracted products...")

print(f"\nExtraction completed! Total items scanned: {count:,}")

if products:
    save_chunk(file_part, products, categories_set)
    print("You can now open these files in Excel, edit your prices, and upload them via 'Import Excel' in your POS.")
else:
    if count == 0:
        print("No matching products found.")
