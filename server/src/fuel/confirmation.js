export function confirmsFuelTraining(value) {
  return typeof value === "string" && value.normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim().replace(/\s+/g, " ").toUpperCase() === "CREATE TEST FUEL DATA";
}
