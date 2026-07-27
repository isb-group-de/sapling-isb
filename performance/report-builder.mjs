import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(import.meta.url);
const moduleDirectory = path.dirname(modulePath);
const templatePath = path.join(moduleDirectory, "report-template.html");
const placeholder = "/*__SAPLING_REPORT_DATA__*/ null";

export function writeReportWebsite(report, directory) {
  const template = readFileSync(templatePath, "utf8");
  if (!template.includes(placeholder)) {
    throw new Error(
      `Report template placeholder is missing in ${templatePath}.`,
    );
  }

  const serializedReport = JSON.stringify(report)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
  const outputPath = path.join(directory, "report.html");
  writeFileSync(
    outputPath,
    template.replace(placeholder, serializedReport),
    "utf8",
  );
  return outputPath;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === modulePath.toLowerCase()
) {
  const matrixArgument = process.argv[2];
  if (!matrixArgument) {
    console.error(
      "Usage: node performance/report-builder.mjs <path-to-matrix.json>",
    );
    process.exitCode = 2;
  } else {
    try {
      const matrixPath = path.resolve(matrixArgument);
      const report = JSON.parse(readFileSync(matrixPath, "utf8"));
      const outputPath = writeReportWebsite(report, path.dirname(matrixPath));
      console.log(`Performance website: ${outputPath}`);
    } catch (error) {
      console.error(`Could not create performance website: ${error.message}`);
      process.exitCode = 2;
    }
  }
}
