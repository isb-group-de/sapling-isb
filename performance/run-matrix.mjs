import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeReportWebsite } from "./report-builder.mjs";

const DEFAULT_USERS = [1, 5, 10, 20, 50, 100];
const DEFAULT_K6_IMAGE = "grafana/k6:0.57.0";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const options = parseArguments(process.argv.slice(2));
const users = parsePositiveIntegerList(
  options.users || process.env.SAPLING_USERS,
  DEFAULT_USERS,
);
const iterations = positiveInteger(
  options.iterations || process.env.SAPLING_ITERATIONS_PER_USER,
  3,
);
const engine =
  options.engine || process.env.SAPLING_PERFORMANCE_ENGINE || "native";
const configuredBaseUrl =
  options.baseUrl ||
  process.env.SAPLING_BASE_URL ||
  "http://localhost:3000/api";
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const resultsDirectory = path.resolve(
  options.results ||
    process.env.SAPLING_RESULTS_DIRECTORY ||
    path.join(scriptDirectory, "results", runId),
);

assertConfiguration(engine);
mkdirSync(resultsDirectory, { recursive: true });

const summaries = [];
let infrastructureFailure = false;

console.log(`Sapling performance matrix: ${users.join(", ")} users`);
console.log(`Engine: ${engine}`);
console.log(`Results: ${resultsDirectory}`);

for (const userCount of users) {
  console.log(
    `\n=== ${userCount} concurrent user${userCount === 1 ? "" : "s"} ===`,
  );
  const summaryFile = path.join(
    resultsDirectory,
    `summary-${String(userCount).padStart(3, "0")}.json`,
  );
  const environment = buildEnvironment(
    userCount,
    iterations,
    summaryFile,
    runId,
    engine,
  );
  const command = buildCommand(engine, environment);
  const execution = spawnSync(command.executable, command.arguments, {
    cwd: scriptDirectory,
    env: environment,
    stdio: "inherit",
    windowsHide: true,
  });

  if (execution.error) {
    infrastructureFailure = true;
    const hint =
      execution.error.code === "ENOENT"
        ? engine === "native"
          ? "Install k6 or rerun with --engine docker."
          : "Install/start Docker or rerun with --engine native."
        : "";
    console.error(
      `Could not start ${command.executable}: ${execution.error.message}. ${hint}`,
    );
    break;
  }

  if (execution.status !== 0 && execution.status !== 99) {
    infrastructureFailure = true;
    console.error(
      `k6 exited with code ${execution.status}; stopping the matrix because this is not a threshold-only failure.`,
    );
    break;
  }

  try {
    const summary = JSON.parse(readFileSync(summaryFile, "utf8"));
    summaries.push(summary);
  } catch (error) {
    infrastructureFailure = true;
    console.error(`Could not read ${summaryFile}: ${error.message}`);
    break;
  }
}

if (summaries.length > 0) {
  writeReports(summaries, resultsDirectory, {
    engine,
    users,
    iterations,
    baseUrl: configuredBaseUrl,
    runId,
  });
  console.log(`\nMatrix report: ${path.join(resultsDirectory, "matrix.md")}`);
  console.log(
    `Machine-readable report: ${path.join(resultsDirectory, "matrix.json")}`,
  );
  console.log(
    `Per-endpoint report: ${path.join(resultsDirectory, "steps.csv")}`,
  );
  console.log(
    `Presentation website: ${path.join(resultsDirectory, "report.html")}`,
  );
}

const thresholdFailure = summaries.some(
  (summary) => summary.thresholdsPassed === false,
);
if (infrastructureFailure || summaries.length !== users.length) {
  process.exitCode = 2;
} else if (thresholdFailure) {
  process.exitCode = 1;
}

function buildEnvironment(
  userCount,
  iterationCount,
  summaryFile,
  currentRunId,
  selectedEngine,
) {
  const environment = {
    ...process.env,
    K6_NO_COLOR: process.env.K6_NO_COLOR || "true",
    SAPLING_BASE_URL:
      selectedEngine === "docker"
        ? dockerBaseUrl(configuredBaseUrl)
        : configuredBaseUrl,
    SAPLING_USERS: String(userCount),
    SAPLING_ITERATIONS_PER_USER: String(iterationCount),
    SAPLING_RESULT_PATH:
      selectedEngine === "docker"
        ? `/results/${path.basename(summaryFile)}`
        : summaryFile,
    SAPLING_RUN_ID: `${currentRunId}-u${userCount}`,
  };
  return environment;
}

function buildCommand(selectedEngine, environment) {
  if (selectedEngine === "native") {
    return {
      executable: process.env.SAPLING_K6_BINARY || "k6",
      arguments: ["run", path.join(scriptDirectory, "sapling-workflow.js")],
    };
  }

  const forwardedVariables = [
    "K6_NO_COLOR",
    "SAPLING_BASE_URL",
    "SAPLING_TOKEN",
    "SAPLING_TOKENS_JSON",
    "SAPLING_USERS",
    "SAPLING_ITERATIONS_PER_USER",
    "SAPLING_THINK_TIME_MS",
    "SAPLING_P95_LIMIT_MS",
    "SAPLING_MAX_ERROR_RATE",
    "SAPLING_MAX_DURATION",
    "SAPLING_WRITE_MODE",
    "SAPLING_TICKET_FILTER",
    "SAPLING_EXTRA_ENTITIES",
    "SAPLING_RESULT_PATH",
    "SAPLING_RUN_ID",
  ].filter((name) => environment[name] !== undefined);
  const dockerArguments = [
    "run",
    "--rm",
    "-v",
    `${scriptDirectory}:/scripts:ro`,
    "-v",
    `${resultsDirectory}:/results`,
  ];
  for (const variableName of forwardedVariables) {
    dockerArguments.push("-e", variableName);
  }
  dockerArguments.push(
    process.env.SAPLING_K6_IMAGE || DEFAULT_K6_IMAGE,
    "run",
    "/scripts/sapling-workflow.js",
  );
  return {
    executable: process.env.SAPLING_DOCKER_BINARY || "docker",
    arguments: dockerArguments,
  };
}

function writeReports(results, directory, configuration) {
  const rows = results
    .slice()
    .sort((left, right) => left.config.users - right.config.users)
    .map(toMatrixRow);
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    configuration,
    results,
  };
  writeFileSync(
    path.join(directory, "matrix.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  writeFileSync(path.join(directory, "matrix.csv"), matrixCsv(rows));
  writeFileSync(path.join(directory, "matrix.md"), matrixMarkdown(rows));
  writeFileSync(path.join(directory, "steps.csv"), stepsCsv(results));
  writeReportWebsite(report, directory);
}

function toMatrixRow(summary) {
  const requests = summary.metrics.httpRequests || {};
  const duration = summary.metrics.httpRequestDuration || {};
  const failures = summary.metrics.httpRequestFailed || {};
  const workflow = summary.metrics.workflowSuccess || {};
  const workflowDuration = summary.metrics.workflowDuration || {};
  const durationSeconds = summary.durationMs ? summary.durationMs / 1000 : 0;
  return {
    users: summary.config.users,
    workflowsExpected: summary.config.expectedWorkflows,
    workflowsCompleted: summary.metrics.iterations?.count || 0,
    workflowSuccessRate: workflow.rate,
    requestCount: requests.count || 0,
    requestsPerSecond:
      durationSeconds > 0 ? (requests.count || 0) / durationSeconds : null,
    httpErrorRate: failures.rate,
    httpAverageMs: duration.avg,
    httpP90Ms: duration["p(90)"],
    httpP95Ms: duration["p(95)"],
    httpP99Ms: duration["p(99)"],
    httpMaxMs: duration.max,
    workflowP95Ms: workflowDuration["p(95)"],
    thresholdsPassed: summary.thresholdsPassed,
  };
}

function matrixCsv(rows) {
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => csvValue(row[header])).join(","),
    ),
    "",
  ].join("\n");
}

function stepsCsv(results) {
  const rows = [];
  for (const summary of results) {
    for (const [step, values] of Object.entries(summary.steps || {})) {
      rows.push({
        users: summary.config.users,
        step,
        count: values.count,
        averageMs: values.avg,
        p90Ms: values["p(90)"],
        p95Ms: values["p(95)"],
        p99Ms: values["p(99)"],
        maxMs: values.max,
      });
    }
  }
  const headers = Object.keys(rows[0] || { users: "", step: "" });
  return [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => csvValue(row[header])).join(","),
    ),
    "",
  ].join("\n");
}

function matrixMarkdown(rows) {
  const lines = [
    "# Sapling performance matrix",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "| Users | Workflows | Success | Requests/s | HTTP errors | HTTP avg | HTTP p95 | HTTP p99 | Workflow p95 | Thresholds |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :--- |",
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.users} | ${row.workflowsCompleted}/${row.workflowsExpected} | ${percent(row.workflowSuccessRate)} | ${decimal(row.requestsPerSecond, 1)} | ${percent(row.httpErrorRate)} | ${milliseconds(row.httpAverageMs)} | ${milliseconds(row.httpP95Ms)} | ${milliseconds(row.httpP99Ms)} | ${milliseconds(row.workflowP95Ms)} | ${row.thresholdsPassed ? "pass" : "fail"} |`,
    );
  }
  lines.push(
    "",
    "Use `steps.csv` to identify which API step grows most strongly as concurrency increases.",
    "",
  );
  return lines.join("\n");
}

function parseArguments(argumentsList) {
  const parsed = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!argument.startsWith("--")) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const [rawName, inlineValue] = argument.slice(2).split("=", 2);
    const name = rawName.replace(/-([a-z])/g, (_, letter) =>
      letter.toUpperCase(),
    );
    const value =
      inlineValue === undefined ? argumentsList[index + 1] : inlineValue;
    if (inlineValue === undefined) {
      index += 1;
    }
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${rawName}`);
    }
    parsed[name] = value;
  }
  return parsed;
}

function assertConfiguration(selectedEngine) {
  if (!["native", "docker"].includes(selectedEngine)) {
    configurationError("--engine must be native or docker.");
  }
  if (!process.env.SAPLING_TOKEN && !process.env.SAPLING_TOKENS_JSON) {
    configurationError(
      "Set SAPLING_TOKEN or SAPLING_TOKENS_JSON. Tokens are accepted only through the environment so they do not enter shell history.",
    );
  }
}

function configurationError(message) {
  console.error(`Configuration error: ${message}`);
  process.exit(2);
}

function parsePositiveIntegerList(value, fallback) {
  if (!value) {
    return fallback;
  }
  const parsed = String(value)
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10));
  if (
    parsed.length === 0 ||
    parsed.some((item) => !Number.isInteger(item) || item <= 0)
  ) {
    throw new Error(
      "The user matrix must be a comma-separated list of positive integers.",
    );
  }
  return [...new Set(parsed)];
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function dockerBaseUrl(baseUrl) {
  return baseUrl
    .replace("://localhost", "://host.docker.internal")
    .replace("://127.0.0.1", "://host.docker.internal");
}

function csvValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function percent(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "n/a";
}

function milliseconds(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} ms` : "n/a";
}

function decimal(value, digits) {
  return Number.isFinite(value) ? value.toFixed(digits) : "n/a";
}
