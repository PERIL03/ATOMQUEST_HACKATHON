function validateGoals(goals) {
  if (!Array.isArray(goals) || goals.length === 0) {
    return { valid: false, message: "At least one goal is required." };
  }
  if (goals.length > 8) {
    return { valid: false, message: "Max 8 goals allowed." };
  }
  let total = 0;
  for (const goal of goals) {
    if (goal.weightage < 10) {
      return { valid: false, message: "Each goal weightage must be at least 10%." };
    }
    total += Number(goal.weightage || 0);
  }
  if (total !== 100) {
    return { valid: false, message: "Total weightage must equal 100%." };
  }
  return { valid: true };
}

module.exports = { validateGoals };
