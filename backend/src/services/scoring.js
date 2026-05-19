function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scoreMin(actual, target) {
  if (actual == null || target == null || target === 0) return null;
  return clamp(actual / target, 0, 1);
}

function scoreMax(actual, target) {
  if (actual == null || target == null || actual === 0) return null;
  return clamp(target / actual, 0, 1);
}

function scoreZeroBased(actual) {
  if (actual == null) return null;
  return actual === 0 ? 1 : 0;
}

function scoreTimeline(completionDate, deadline, startDate) {
  if (!completionDate || !deadline || !startDate) return null;
  const totalDuration = deadline.getTime() - startDate.getTime();
  if (totalDuration <= 0) {
    return completionDate <= deadline ? 1 : 0;
  }
  const score = 1 + (deadline.getTime() - completionDate.getTime()) / totalDuration;
  return clamp(score, 0, 1);
}

function computeScore({
  uom,
  performance,
  actualValue,
  targetValue,
  completionDate,
  deadline,
  startDate,
}) {
  if (uom === "ZERO_BASED") {
    return scoreZeroBased(actualValue);
  }
  if (uom === "TIMELINE") {
    return scoreTimeline(completionDate, deadline, startDate);
  }
  if (performance === "MAX") {
    return scoreMax(actualValue, targetValue);
  }
  return scoreMin(actualValue, targetValue);
}

module.exports = { computeScore };
