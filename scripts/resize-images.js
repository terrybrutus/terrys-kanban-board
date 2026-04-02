import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";

const DIMENSION_PATTERN = /^(.+?)\.dim_(\d+)x(\d+)(\.[^.]+)$/;
const DIST_ASSETS_DIR = "src/frontend/dist/assets";
const GENERATED_DIR = path.join(DIST_ASSETS_DIR, "generated");
const IMAGE_DIRS = [GENERATED_DIR, DIST_ASSETS_DIR];

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getOutputOptions(ext) {
  const extension = ext.toLowerCase();

  switch (extension) {
    case ".png":
      return {
        format: "png",
        options: {
          compressionLevel: 6, // (0-9) 6 for balance of speed and size
          palette: true, // Quantize to 256 colors
          quality: 80, // Quality for palette quantization
          effort: 8, // (0-10)
          adaptiveFiltering: true,
        },
      };
    case ".jpg":
    case ".jpeg":
      return {
        format: "jpeg",
        options: {
          quality: 80, // 80 is a good balance
          mozjpeg: true, // Use MozJPEG encoder (much better compression)
          trellisQuantisation: true,
          overshootDeringing: true,
          optimizeScans: true,
        },
      };
    case ".webp":
      return {
        format: "webp",
        options: {
          quality: 80,
          effort: 6, // Max effort (0-6)
          smartSubsample: true,
        },
      };
    default:
      return null;
  }
}

async function resizeImagesInDir(dir) {
  if (!(await fileExists(dir))) {
    return 0;
  }

  let files;
  try {
    files = await fs.readdir(dir);
  } catch (error) {
    console.log(`Could not read ${dir}: ${error.message}`);
    return 0;
  }

  let resizedCount = 0;

  for (const file of files) {
    const match = file.match(DIMENSION_PATTERN);
    if (match) {
      const [, , width, height, ext] = match;
      const filePath = path.join(dir, file);
      const outputConfig = getOutputOptions(ext);

      if (!outputConfig) {
        console.log(`Skipping unsupported format: ${file}`);
        continue;
      }

      try {
        let pipeline = sharp(filePath)
          .resize(parseInt(width, 10), parseInt(height, 10), {
            fit: "cover",
            withoutEnlargement: false,
            position: "center",
          })
          .keepIccProfile();

        // Apply format-specific optimization
        pipeline = pipeline[outputConfig.format](outputConfig.options);

        const resized = await pipeline.toBuffer();
        await fs.writeFile(filePath, resized);
        resizedCount++;
      } catch (error) {
        console.error(`Failed to resize ${file}:`, error.message);
      }
    }
  }

  return resizedCount;
}

async function resizeImages() {
  let totalResized = 0;

  for (const dir of IMAGE_DIRS) {
    const count = await resizeImagesInDir(dir);
    if (count > 0) {
      console.log(`Resized ${count} image(s) in ${dir}`);
    }
    totalResized += count;
  }

  if (totalResized > 0) {
    console.log(`Resized ${totalResized} image(s) total`);
  } else {
    console.log("No images to resize");
  }
}

resizeImages().catch((error) => {
  console.error("Image resize process failed:", error);
  process.exit(1);
});
