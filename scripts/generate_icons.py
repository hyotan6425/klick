from PIL import Image
import os

def main():
    try:
        input_path = "/tmp/file_attachments/icon.png"
        output_dir = "icons"

        if not os.path.exists(input_path):
            print(f"Error: {input_path} not found.")
            return

        img = Image.open(input_path)

        # Ensure it's in RGBA format (though we're converting from JPEG, we might want transparency if we add any)
        # Since it's JPEG, it has no alpha, so just convert to RGB.
        img = img.convert("RGBA")

        sizes = [16, 48, 128]
        for size in sizes:
            resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
            output_filename = f"icon{size}.png"
            output_path = os.path.join(output_dir, output_filename)
            resized_img.save(output_path, "PNG")
            print(f"Saved {output_path}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
