const path = require("path");
const indexService = require("./index-service");
const imageFeatureService = require("./image-feature-service");
const similarityService = require("./similarity-service");
const decisionService = require("./decision-service");
const historyService = require("./history-service");

class DetectionService {
  async detectNewImage({ newImagePath, detectionDirectory, triggerType, settings }) {
    const imageFeature = await imageFeatureService.extractFeatures(newImagePath);
    const indexedImages = indexService.getIndexedImagesByDirectory(detectionDirectory);

    const comparableImages = indexedImages.filter((img) => img.file_path !== newImagePath);
    const similarityResult = similarityService.compare(imageFeature, comparableImages, settings);
    const recommendedAction = decisionService.recommendAction(similarityResult.finalLevel, settings);

    const recordId = historyService.createDetectionRecord({
      triggerType,
      newImagePath,
      detectionDirectory,
      hitCount: similarityResult.ranked.length,
      topSimilarityScore: similarityResult.topScore,
      finalLevel: similarityResult.finalLevel,
      recommendedAction,
      ignored: false
    });

    historyService.saveMatches(recordId, similarityResult.ranked);

    return {
      recordId,
      newImage: {
        path: newImagePath,
        fileName: path.basename(newImagePath),
        width: imageFeature.width,
        height: imageFeature.height,
        fileSize: imageFeature.fileSize
      },
      matches: similarityResult.ranked,
      topSimilarityScore: similarityResult.topScore,
      finalLevel: similarityResult.finalLevel,
      recommendedAction,
      features: imageFeature
    };
  }
}

module.exports = new DetectionService();
