const explanations = {
  13: "The database account does not have permission for this operation.",
  26: "A required database collection is missing. Prepare the fuel module again.",
  50: "The database operation exceeded its time limit.",
  112: "Another request changed the same records. Refresh before retrying.",
  121: "The live database rejected a record under its collection validation rules.",
  244: "The database temporarily could not acquire a transaction lock.",
  251: "The database transaction ended before the operation completed.",
  263: "The database does not support this operation inside a transaction.",
  8000: "The database provider rejected the operation. Its error code is shown below.",
};
export function fuelFailureResponse(error, request, status) {
  const generic = "Fuel operation failed; no posting was completed.";
  if (status < 500 || status === 503) return { error: error.message };
  const owner = ["ceo", "super_admin"].includes(request.user?.role);
  if (!owner) return { error: generic + " Contact the CEO or Super Admin." };
  const step = error.fuelDemoStep || "process fuel request";
  const databaseCode = Number.isSafeInteger(error.code) ? String(error.code) : "unavailable";
  const allowedTypes = ["MongoServerError", "MongoNetworkError", "MongoServerSelectionError", "MongoBulkWriteError", "MongooseError", "VersionError", "TypeError", "Error"];
  const type = allowedTypes.includes(error.name) ? error.name : "ServerError";
  const release = /^[a-f0-9]{7,40}$/i.test(process.env.RAILWAY_GIT_COMMIT_SHA || "")
    ? process.env.RAILWAY_GIT_COMMIT_SHA.slice(0, 7) : "local";
  const reference = String(request.id || "unavailable").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  const explanation = explanations[error.code] || "The server rejected this step. Share the diagnostic below so it can be investigated.";
  // Never send raw database messages, stacks, queries, record values or connection strings.
  return {
    error: `${generic} Step: ${step}. ${explanation} Diagnostic: ${type}; database code ${databaseCode}; release ${release}; reference ${reference}.`,
    diagnostic: { step, type, databaseCode, release, reference },
  };
}
