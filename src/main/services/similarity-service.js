const { DETECTION_LEVEL } = require("./constants");

class SimilarityService {
  hammingDistance(hexA, hexB) {
    if (!hexA || !hexB || hexA.length !== hexB.length) {
      return Number.MAX_SAFE_INTEGER;
    }

    let dist = 0;
    for (let i = 0; i < hexA.length; i += 1) {
      const xor = parseInt(hexA[i], 16) ^ parseInt(hexB[i], 16);
      dist += xor.toString(2).split("1").length - 1;
    }
    return dist;
  }

  hashScore(hashA, hashB) {
    const maxBits = hashA.length * 4;
    const distance = this.hammingDistance(hashA, hashB);
    if (!Number.isFinite(distance)) return 0;
    return Math.max(0, ((maxBits - distance) / maxBits) * 100);
  }

  classify(score, settings) {
    if (score >= settings.exactDuplicateThreshold) {
      return DETECTION_LEVEL.EXACT_DUPLICATE;
    }
    if (score >= settings.highSimilarityThreshold) {
      return DETECTION_LEVEL.HIGH_SIMILARITY;
    }
    if (score >= settings.mediumSimilarityThreshold) {
      return DETECTION_LEVEL.MEDIUM_SIMILARITY;
    }
    return DETECTION_LEVEL.NOT_SIMILAR;
  }

  compare(newImageFeature, indexedImages, settings) {
    const candidates = indexedImages.map((img) => {
      if (img.file_hash === newImageFeature.fileHash) {
        return {
          imageId: img.id,
          matchFilePath: img.file_path,
          score: 100,
          level: DETECTION_LEVEL.EXACT_DUPLICATE,
          matchReason: "FILE_HASH"
        };
      }

      const aScore = this.hashScore(newImageFeature.ahash, img.ahash);
      const dScore = this.hashScore(newImageFeature.dhash, img.dhash);
      const pScore = this.hashScore(newImageFeature.phash, img.phash);
      const score = (aScore + dScore + pScore) / 3;
      return {
        imageId: img.id,
        matchFilePath: img.file_path,
        score: Number(score.toFixed(2)),
        level: this.classify(score, settings),
        matchReason: "PERCEPTUAL_HASH"
      };
    });

    const ranked = candidates.sort((a, b) => b.score - a.score).slice(0, settings.topNMatches);
    const topScore = ranked.length > 0 ? ranked[0].score : 0;
    const finalLevel = this.classify(topScore, settings);

    return { ranked, topScore, finalLevel };
  }
}

module.exports = new SimilarityService();
