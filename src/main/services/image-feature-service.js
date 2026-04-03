const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");
const imghash = require("imghash");

class ImageFeatureService {
  validateImage(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error("图片不存在");
    }
  }

  async fileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = fs.createReadStream(filePath);
      stream.on("error", reject);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex")));
    });
  }

  async metadata(filePath) {
    const stat = fs.statSync(filePath);
    const image = sharp(filePath, { failOn: "warning" });
    const meta = await image.metadata();

    if (!meta.width || !meta.height) {
      throw new Error("图片损坏无法读取");
    }

    return {
      filePath,
      fileName: path.basename(filePath),
      directoryPath: path.dirname(filePath),
      fileSize: stat.size,
      width: meta.width,
      height: meta.height,
      imageFormat: meta.format || path.extname(filePath).replace(".", ""),
      modifiedTime: stat.mtimeMs,
      createdTime: stat.birthtimeMs || null
    };
  }

  async perceptualHashes(filePath) {
    const [ahash, dhash, phash] = await Promise.all([
      imghash.hash(filePath, 16, "hex", "ahash"),
      imghash.hash(filePath, 16, "hex", "dhash"),
      imghash.hash(filePath, 16, "hex", "phash")
    ]);
    return { ahash, dhash, phash };
  }

  async extractFeatures(filePath) {
    this.validateImage(filePath);
    const [meta, fileHash, hashes] = await Promise.all([
      this.metadata(filePath),
      this.fileHash(filePath),
      this.perceptualHashes(filePath)
    ]);

    return {
      ...meta,
      fileHash,
      pixelHash: null,
      ...hashes,
      featureVectorRef: null,
      featureVectorBlob: null
    };
  }

  // Extension hook for deep models in the next version.
  async extractDeepFeatureVector(_filePath) {
    return null;
  }
}

module.exports = new ImageFeatureService();
