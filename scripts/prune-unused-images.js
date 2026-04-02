import { promises as fs } from "fs";
import path from "path";

const DIST_ASSETS_DIR = "src/frontend/dist/assets";
const GENERATED_DIR = path.join(DIST_ASSETS_DIR, "generated");

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
  ".ico",
  ".avif",
]);

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getAssetFiles(dir) {
  const files = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip the generated folder itself
        if (entry.name !== "generated") {
          files.push(...(await getAssetFiles(fullPath)));
        }
      } else if (
        entry.name.endsWith(".js") ||
        entry.name.endsWith(".mjs") ||
        entry.name.endsWith(".css")
      ) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }

  return files;
}

async function getImagesInDir(dir) {
  const images = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (IMAGE_EXTENSIONS.has(ext)) {
          images.push(entry.name);
        }
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(`Error reading directory ${dir}:`, error.message);
    }
  }

  return images;
}


async function pruneImagesInDir(dir, label, combinedContent) {
  const images = await getImagesInDir(dir);

  if (images.length === 0) {
    return { removedCount: 0, savedBytes: 0 };
  }

  console.log(`Found ${images.length} image(s) in ${label} folder`);

  const referencedImages = new Set();
  for (const filename of images) {
    if (combinedContent.includes(filename)) {
      referencedImages.add(filename);
    }
  }

  console.log(
    `Found ${referencedImages.size} ${label} image reference(s) in compiled assets`,
  );

  const unusedImages = images.filter((img) => !referencedImages.has(img));

  if (unusedImages.length === 0) {
    console.log(`No unused ${label} images to prune`);
    return { removedCount: 0, savedBytes: 0 };
  }

  let removedCount = 0;
  let savedBytes = 0;

  const BATCH_SIZE = 10;
  for (let i = 0; i < unusedImages.length; i += BATCH_SIZE) {
    const batch = unusedImages.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map(async (image) => {
        const imagePath = path.join(dir, image);
        try {
          const stats = await fs.stat(imagePath);
          await fs.unlink(imagePath);
          return { success: true, image, size: stats.size };
        } catch (error) {
          return { success: false, image, error: error.message };
        }
      }),
    );

    for (const result of results) {
      if (result.success) {
        removedCount++;
        savedBytes += result.size;
        console.log(`  Removed: ${result.image} (${formatBytes(result.size)})`);
      } else {
        console.error(`  Failed to remove ${result.image}: ${result.error}`);
      }
    }
  }

  return { removedCount, savedBytes };
}

async function pruneUnusedImages() {
  if (!(await fileExists(DIST_ASSETS_DIR))) {
    console.log(`Directory ${DIST_ASSETS_DIR} does not exist, skipping prune`);
    return;
  }

  const assetFiles = await getAssetFiles(DIST_ASSETS_DIR);

  if (assetFiles.length === 0) {
    console.log("No JS/CSS files found in dist/assets, skipping prune");
    return;
  }

  const jsCount = assetFiles.filter(
    (f) => f.endsWith(".js") || f.endsWith(".mjs"),
  ).length;
  const cssCount = assetFiles.filter((f) => f.endsWith(".css")).length;
  console.log(
    `Scanning ${jsCount} JS file(s) and ${cssCount} CSS file(s) for image references...`,
  );

  // Read all JS/CSS content once, reuse for both directories
  const contents = await Promise.all(
    assetFiles.map((file) => fs.readFile(file, "utf-8").catch(() => "")),
  );
  const combinedContent = contents.join("\n");

  const generated = await pruneImagesInDir(
    GENERATED_DIR,
    "generated",
    combinedContent,
  );
  const uploaded = await pruneImagesInDir(
    DIST_ASSETS_DIR,
    "uploaded",
    combinedContent,
  );

  const totalRemoved = generated.removedCount + uploaded.removedCount;
  const totalSaved = generated.savedBytes + uploaded.savedBytes;

  if (totalRemoved > 0) {
    console.log(
      `\nPruned ${totalRemoved} unused image(s) total, saved ${formatBytes(totalSaved)}`,
    );
  } else {
    console.log("\nNo unused images to prune");
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

pruneUnusedImages().catch((error) => {
  console.error("Image prune process failed:", error);
  process.exit(1);
});
