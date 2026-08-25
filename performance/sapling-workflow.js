import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const DEFAULT_EXTRA_ENTITIES = "salesOpportunity,event";
const GENERIC_PAGE_LIMIT = 20;
const BASE_URL = (
  __ENV.SAPLING_BASE_URL || "http://localhost:3000/api"
).replace(/\/+$/, "");
const USERS = positiveInteger(__ENV.SAPLING_USERS, 1);
const ITERATIONS_PER_USER = positiveInteger(
  __ENV.SAPLING_ITERATIONS_PER_USER,
  10,
);
const THINK_TIME_SECONDS =
  nonNegativeNumber(__ENV.SAPLING_THINK_TIME_MS, 250) / 1000;
const P95_LIMIT_MS = positiveNumber(__ENV.SAPLING_P95_LIMIT_MS, 2000);
const MAX_ERROR_RATE = rate(__ENV.SAPLING_MAX_ERROR_RATE, 0.01);
const MAX_DURATION = __ENV.SAPLING_MAX_DURATION || "10m";
const WRITE_MODE = parseWriteMode(__ENV.SAPLING_WRITE_MODE || "none");
const EXTRA_ENTITIES = parseEntityHandles(
  __ENV.SAPLING_EXTRA_ENTITIES ?? DEFAULT_EXTRA_ENTITIES,
);
const METADATA_ENTITIES = [
  ...new Set(["ticket", "person", "company", ...EXTRA_ENTITIES]),
];
const TICKET_FILTER = parseJsonObject(
  __ENV.SAPLING_TICKET_FILTER,
  "SAPLING_TICKET_FILTER",
);
const AUTH_MODE = parseAuthMode();
const CREDENTIALS =
  AUTH_MODE === "session" ? parseSessionCookies() : parseTokens();

const workflowDuration = new Trend("workflow_duration", true);
const workflowSuccess = new Rate("workflow_success");
const workflowFailures = new Counter("workflow_failures");
const serverTimingTrends = Object.fromEntries(
  ["auth", "handler", "total"].map((phase) => [
    phase,
    new Trend(`server_${phase}_duration`, true),
  ]),
);
const serverTimingMissing = new Counter("server_timing_missing");

const coreSteps = [
  "current_person",
  "current_meta",
  "current_permission",
  "ticket_template",
  "ticket_list",
  "ticket_detail",
  "ticket_timeline",
  "ticket_change_log",
  "ticket_update",
  "ticket_restore",
  "person_template",
  "person_list",
  "person_detail",
  "company_template",
  "company_list",
  "company_detail",
  "global_search",
];
const extraSteps = EXTRA_ENTITIES.flatMap((entityHandle) => [
  `${metricName(entityHandle)}_template`,
  `${metricName(entityHandle)}_list`,
]);
const workflowSteps = [...new Set([...coreSteps, ...extraSteps])];
const stepTrends = Object.fromEntries(
  workflowSteps.map((step) => [step, new Trend(`step_${step}`, true)]),
);
const stepServerTimingTrends = Object.fromEntries(
  Object.keys(stepTrends).map((step) => [
    step,
    Object.fromEntries(
      ["auth", "handler", "total"].map((phase) => [
        phase,
        new Trend(`step_${step}_server_${phase}`, true),
      ]),
    ),
  ]),
);
const stepServerTimingMissing = Object.fromEntries(
  Object.keys(stepTrends).map((step) => [
    step,
    new Counter(`step_${step}_server_timing_missing`),
  ]),
);
const failureCategories = ["transport", "client", "server", "unexpected"];
const requestFailures = new Counter("request_failures");
const requestFailureCategories = Object.fromEntries(
  failureCategories.map((category) => [
    category,
    new Counter(`request_${category}_failures`),
  ]),
);
const failureStatus = new Trend("failure_status");
const failureErrorCode = new Trend("failure_error_code");
const stepFailures = Object.fromEntries(
  workflowSteps.map((step) => [
    step,
    {
      total: new Counter(`step_${step}_failures`),
      categories: Object.fromEntries(
        failureCategories.map((category) => [
          category,
          new Counter(`step_${step}_${category}_failures`),
        ]),
      ),
      status: new Trend(`step_${step}_failure_status`),
      errorCode: new Trend(`step_${step}_failure_error_code`),
    },
  ]),
);

export const options = {
  summaryTrendStats: [
    "avg",
    "min",
    "med",
    "max",
    "p(90)",
    "p(95)",
    "p(99)",
    "count",
  ],
  scenarios: {
    sapling_workflow: {
      executor: "per-vu-iterations",
      vus: USERS,
      iterations: ITERATIONS_PER_USER,
      maxDuration: MAX_DURATION,
    },
  },
  thresholds: {
    checks: [`rate>${1 - MAX_ERROR_RATE}`],
    http_req_failed: [`rate<${MAX_ERROR_RATE}`],
    http_req_duration: [`p(95)<${P95_LIMIT_MS}`],
    workflow_success: [`rate>${1 - MAX_ERROR_RATE}`],
  },
  userAgent: "sapling-performance-test/1.0",
};

export default function saplingWorkflow() {
  const startedAt = Date.now();
  let successful = true;
  let selectedTicket = null;

  try {
    successful =
      requestStep("current_person", "GET", apiUrl("current/person")).ok &&
      successful;
    successful =
      requestStep(
        "current_meta",
        "GET",
        apiUrl("current/meta", {
          entities: METADATA_ENTITIES.join(","),
        }),
      ).ok && successful;
    successful =
      requestStep("current_permission", "GET", apiUrl("current/permission"))
        .ok && successful;

    pause();

    successful =
      requestStep("ticket_template", "GET", apiUrl("template/ticket")).ok &&
      successful;

    const ticketQuery = {
      page: 1,
      limit: GENERIC_PAGE_LIMIT,
      relations: JSON.stringify([
        "status",
        "priority",
        "type",
        "category",
        "creatorCompany",
        "creatorPerson",
        "assigneeCompany",
        "assigneePerson",
      ]),
    };
    if (TICKET_FILTER) {
      ticketQuery.filter = JSON.stringify(TICKET_FILTER);
    }

    const ticketList = requestStep(
      "ticket_list",
      "GET",
      apiUrl("generic/ticket", ticketQuery),
    );
    successful = ticketList.ok && successful;
    const tickets = responseItems(ticketList.response);
    const hasTicket = check(tickets, {
      "ticket list contains at least one record": (items) => items.length > 0,
    });
    successful = hasTicket && successful;

    if (hasTicket) {
      selectedTicket = tickets[(__VU - 1) % tickets.length];
      const ticketDetail = requestStep(
        "ticket_detail",
        "GET",
        apiUrl("generic/ticket", {
          page: 1,
          limit: 1,
          filter: JSON.stringify({ handle: selectedTicket.handle }),
          relations: ticketQuery.relations,
        }),
      );
      successful = ticketDetail.ok && successful;
      selectedTicket =
        responseItems(ticketDetail.response)[0] || selectedTicket;

      pause();

      successful =
        requestStep(
          "ticket_timeline",
          "GET",
          apiUrl(
            `generic/ticket/${encodeURIComponent(selectedTicket.handle)}/timeline`,
            { months: 3 },
          ),
        ).ok && successful;
      successful =
        requestStep(
          "ticket_change_log",
          "GET",
          apiUrl(
            `generic/ticket/${encodeURIComponent(selectedTicket.handle)}/change-log`,
          ),
        ).ok && successful;

      const writeResult = exerciseTicketUpdate(selectedTicket);
      successful = writeResult.ok && successful;
      selectedTicket = writeResult.ticket;
    }

    pause();

    const personResult = browseEntity("person");
    successful = personResult.ok && successful;

    pause();

    const companyResult = browseEntity("company");
    successful = companyResult.ok && successful;

    pause();

    for (const entityHandle of EXTRA_ENTITIES) {
      const stepPrefix = metricName(entityHandle);
      successful =
        requestStep(
          `${stepPrefix}_template`,
          "GET",
          apiUrl(`template/${encodeURIComponent(entityHandle)}`),
          null,
          { entity: entityHandle },
        ).ok && successful;
      successful =
        requestStep(
          `${stepPrefix}_list`,
          "GET",
          apiUrl(`generic/${encodeURIComponent(entityHandle)}`, {
            page: 1,
            limit: GENERIC_PAGE_LIMIT,
          }),
          null,
          { entity: entityHandle },
        ).ok && successful;
    }

    const searchQuery = searchTerm(selectedTicket);
    successful =
      requestStep(
        "global_search",
        "GET",
        apiUrl("command-palette/records", {
          query: searchQuery,
          limit: 20,
        }),
      ).ok && successful;
  } catch (error) {
    successful = false;
    console.error(`Workflow failed for VU ${__VU}: ${String(error)}`);
  } finally {
    workflowDuration.add(Date.now() - startedAt);
    workflowSuccess.add(successful);
    if (!successful) {
      workflowFailures.add(1);
    }
  }
}

function browseEntity(entityHandle) {
  const prefix = metricName(entityHandle);
  let successful = requestStep(
    `${prefix}_template`,
    "GET",
    apiUrl(`template/${encodeURIComponent(entityHandle)}`),
  ).ok;
  const listResult = requestStep(
    `${prefix}_list`,
    "GET",
    apiUrl(`generic/${encodeURIComponent(entityHandle)}`, {
      page: 1,
      limit: GENERIC_PAGE_LIMIT,
    }),
  );
  successful = listResult.ok && successful;

  const records = responseItems(listResult.response);
  if (records.length === 0) {
    return { ok: successful };
  }

  const record = records[(__VU - 1) % records.length];
  const detailResult = requestStep(
    `${prefix}_detail`,
    "GET",
    apiUrl(`generic/${encodeURIComponent(entityHandle)}`, {
      page: 1,
      limit: 1,
      filter: JSON.stringify({ handle: record.handle }),
    }),
  );
  return { ok: detailResult.ok && successful };
}

function exerciseTicketUpdate(ticket) {
  if (WRITE_MODE === "none") {
    return { ok: true, ticket };
  }

  const originalTitle = ticket?.title;
  const canUpdate = check(ticket, {
    "selected ticket has an editable title": (item) =>
      typeof item?.title === "string" && item.title.length > 0,
  });
  if (!canUpdate) {
    return { ok: false, ticket };
  }

  const concurrencyQuery = {
    handle: ticket.handle,
  };
  if (ticket.updatedAt) {
    concurrencyQuery.expectedUpdatedAt = ticket.updatedAt;
  }

  const suffix = ` [perf ${__ENV.SAPLING_RUN_ID || "run"}-${__VU}]`;
  const nextTitle =
    WRITE_MODE === "round-trip"
      ? `${originalTitle.slice(0, Math.max(1, 128 - suffix.length))}${suffix}`
      : originalTitle;
  const updateResult = requestStep(
    "ticket_update",
    "PATCH",
    apiUrl("generic/ticket", concurrencyQuery),
    { title: nextTitle },
  );
  if (!updateResult.ok) {
    return { ok: false, ticket };
  }

  const updatedTicket = responseObject(updateResult.response) || ticket;
  if (WRITE_MODE !== "round-trip") {
    return { ok: true, ticket: updatedTicket };
  }

  const restoreQuery = {
    handle: ticket.handle,
  };
  if (updatedTicket.updatedAt) {
    restoreQuery.expectedUpdatedAt = updatedTicket.updatedAt;
  }
  const restoreResult = requestStep(
    "ticket_restore",
    "PATCH",
    apiUrl("generic/ticket", restoreQuery),
    { title: originalTitle },
  );
  return {
    ok: restoreResult.ok,
    ticket: responseObject(restoreResult.response) || ticket,
  };
}

function requestStep(step, method, url, body = null, tags = {}) {
  const payload = body === null ? null : JSON.stringify(body);
  const response = http.request(method, url, payload, {
    headers: {
      Accept: "application/json",
      ...authHeaders(),
      ...(body === null ? {} : { "Content-Type": "application/json" }),
    },
    tags: {
      name: step,
      step,
      ...tags,
    },
  });
  stepTrends[step].add(response.timings.duration);
  recordServerTiming(step, response);
  const ok = check(response, {
    [`${step} returns 2xx`]: (result) =>
      result.status >= 200 && result.status < 300,
  });
  if (!ok) {
    recordRequestFailure(step, response);
  }
  return { ok, response };
}

function recordRequestFailure(step, response) {
  const status = Number.isFinite(Number(response?.status))
    ? Number(response.status)
    : 0;
  const rawErrorCode = response?.error_code;
  const errorCode =
    rawErrorCode === null || rawErrorCode === undefined
      ? Number.NaN
      : Number(rawErrorCode);
  const category =
    status === 0
      ? "transport"
      : status >= 400 && status < 500
        ? "client"
        : status >= 500 && status < 600
          ? "server"
          : "unexpected";

  requestFailures.add(1);
  requestFailureCategories[category].add(1);
  failureStatus.add(status);
  stepFailures[step].total.add(1);
  stepFailures[step].categories[category].add(1);
  stepFailures[step].status.add(status);
  if (Number.isFinite(errorCode)) {
    failureErrorCode.add(errorCode);
    stepFailures[step].errorCode.add(errorCode);
  }

  const error = String(response?.error || "unbekannt")
    .replace(/\s+/g, " ")
    .slice(0, 240);
  console.error(
    `[request-failure] step=${step} status=${status} error_code=${Number.isFinite(errorCode) ? errorCode : "-"} error=${error}`,
  );
}

function recordServerTiming(step, response) {
  const timings = parseServerTiming(response?.headers?.["Server-Timing"]);
  let complete = true;

  for (const phase of ["auth", "handler", "total"]) {
    const duration = timings[phase];
    if (!Number.isFinite(duration)) {
      complete = false;
      continue;
    }
    serverTimingTrends[phase].add(duration);
    stepServerTimingTrends[step][phase].add(duration);
  }

  if (!complete) {
    serverTimingMissing.add(1);
    stepServerTimingMissing[step].add(1);
  }
}

function parseServerTiming(header) {
  if (typeof header !== "string" || !header.trim()) {
    return {};
  }

  const result = {};
  for (const entry of header.split(",")) {
    const segments = entry
      .split(";")
      .map((segment) => segment.trim())
      .filter(Boolean);
    const name = segments[0]?.toLowerCase();
    if (!name) continue;

    const durationSegment = segments.find((segment) =>
      segment.toLowerCase().startsWith("dur="),
    );
    if (!durationSegment) continue;

    const duration = Number(
      durationSegment.slice(durationSegment.indexOf("=") + 1),
    );
    if (Number.isFinite(duration) && duration >= 0) {
      result[name] = duration;
    }
  }
  return result;
}

function responseItems(response) {
  const body = responseObject(response);
  return Array.isArray(body?.data) ? body.data : [];
}

function responseObject(response) {
  if (!response || !response.body) {
    return null;
  }
  try {
    const value = response.json();
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function apiUrl(path, query = {}) {
  const queryString = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");
  return `${BASE_URL}/${path}${queryString ? `?${queryString}` : ""}`;
}

function pause() {
  if (THINK_TIME_SECONDS > 0) {
    sleep(THINK_TIME_SECONDS);
  }
}

function searchTerm(ticket) {
  const candidate =
    typeof ticket?.title === "string"
      ? ticket.title.trim().split(/\s+/)[0]
      : "";
  return candidate.slice(0, 64) || "a";
}

function tokenForVu() {
  // Keep one identity for a complete virtual-user workflow. VUs are assigned
  // token 1..n in order and wrap back to token 1 after the last token.
  return CREDENTIALS[(__VU - 1) % CREDENTIALS.length];
}

function authHeaders() {
  return AUTH_MODE === "session"
    ? { Cookie: tokenForVu() }
    : { Authorization: `Bearer ${tokenForVu()}` };
}

function parseAuthMode() {
  const configured = (__ENV.SAPLING_AUTH_MODE || "").trim().toLowerCase();
  const mode =
    configured || (__ENV.SAPLING_SESSION_COOKIES_JSON ? "session" : "bearer");
  if (!["bearer", "session"].includes(mode)) {
    throw new Error("SAPLING_AUTH_MODE must be bearer or session.");
  }
  return mode;
}

function parseSessionCookies() {
  if (!__ENV.SAPLING_SESSION_COOKIES_JSON) {
    throw new Error(
      "Set SAPLING_SESSION_COOKIES_JSON when SAPLING_AUTH_MODE=session.",
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(__ENV.SAPLING_SESSION_COOKIES_JSON);
  } catch {
    throw new Error(
      "SAPLING_SESSION_COOKIES_JSON must be a JSON string array.",
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error(
      "SAPLING_SESSION_COOKIES_JSON must be a JSON string array.",
    );
  }
  const cookies = parsed.filter(
    (cookie) => typeof cookie === "string" && cookie.trim().length > 0,
  );
  if (cookies.length === 0) {
    throw new Error("SAPLING_SESSION_COOKIES_JSON contains no session cookie.");
  }
  return cookies;
}

function parseTokens() {
  let tokens = [];
  if (__ENV.SAPLING_TOKENS_JSON) {
    let parsed;
    try {
      parsed = JSON.parse(__ENV.SAPLING_TOKENS_JSON);
    } catch {
      throw new Error("SAPLING_TOKENS_JSON must be a JSON string array.");
    }
    if (!Array.isArray(parsed)) {
      throw new Error("SAPLING_TOKENS_JSON must be a JSON string array.");
    }
    tokens = parsed
      .filter((token) => typeof token === "string")
      .map((token) => token.trim())
      .filter(Boolean);
  } else if (__ENV.SAPLING_TOKEN?.trim()) {
    tokens = [__ENV.SAPLING_TOKEN.trim()];
  }
  if (tokens.length === 0) {
    throw new Error(
      "Set SAPLING_TOKEN or SAPLING_TOKENS_JSON before running the test.",
    );
  }
  return tokens;
}

function parseJsonObject(value, variableName) {
  if (!value?.trim()) {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${variableName} must contain valid JSON.`);
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${variableName} must contain a JSON object.`);
  }
  return parsed;
}

function parseEntityHandles(value) {
  if (!value.trim()) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseWriteMode(value) {
  if (!["none", "same-value", "round-trip"].includes(value)) {
    throw new Error(
      "SAPLING_WRITE_MODE must be none, same-value, or round-trip.",
    );
  }
  return value;
}

function metricName(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .toLowerCase();
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function rate(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed < 1
    ? parsed
    : fallback;
}

export function handleSummary(data) {
  const result = {
    schemaVersion: 3,
    generatedAt: new Date().toISOString(),
    config: {
      baseUrl: BASE_URL,
      users: USERS,
      iterationsPerUser: ITERATIONS_PER_USER,
      expectedWorkflows: USERS * ITERATIONS_PER_USER,
      authMode: AUTH_MODE,
      credentialCount: CREDENTIALS.length,
      thinkTimeMs: THINK_TIME_SECONDS * 1000,
      writeMode: WRITE_MODE,
      extraEntities: EXTRA_ENTITIES,
      ticketFilter: TICKET_FILTER,
      p95LimitMs: P95_LIMIT_MS,
      maxErrorRate: MAX_ERROR_RATE,
    },
    durationMs: data.state?.testRunDurationMs ?? null,
    thresholdsPassed: thresholdsPassed(data.metrics),
    metrics: {
      httpRequests: values(data, "http_reqs"),
      httpRequestDuration: values(data, "http_req_duration"),
      httpRequestFailed: values(data, "http_req_failed"),
      checks: values(data, "checks"),
      iterations: values(data, "iterations"),
      iterationDuration: values(data, "iteration_duration"),
      workflowDuration: values(data, "workflow_duration"),
      workflowSuccess: values(data, "workflow_success"),
      workflowFailures: values(data, "workflow_failures"),
      dataReceived: values(data, "data_received"),
      dataSent: values(data, "data_sent"),
      serverTiming: {
        auth: values(data, "server_auth_duration"),
        handler: values(data, "server_handler_duration"),
        total: values(data, "server_total_duration"),
        missing: values(data, "server_timing_missing"),
      },
    },
    steps: Object.fromEntries(
      Object.keys(stepTrends)
        .filter((step) => data.metrics[`step_${step}`])
        .map((step) => [step, values(data, `step_${step}`)]),
    ),
    stepServerTiming: Object.fromEntries(
      Object.keys(stepTrends).map((step) => [
        step,
        {
          auth: values(data, `step_${step}_server_auth`),
          handler: values(data, `step_${step}_server_handler`),
          total: values(data, `step_${step}_server_total`),
          missing: values(data, `step_${step}_server_timing_missing`),
        },
      ]),
    ),
    failureDiagnostics: {
      total: values(data, "request_failures"),
      transport: values(data, "request_transport_failures"),
      client: values(data, "request_client_failures"),
      server: values(data, "request_server_failures"),
      unexpected: values(data, "request_unexpected_failures"),
      status: values(data, "failure_status"),
      errorCode: values(data, "failure_error_code"),
      steps: Object.fromEntries(
        workflowSteps.map((step) => [
          step,
          {
            total: values(data, `step_${step}_failures`),
            transport: values(data, `step_${step}_transport_failures`),
            client: values(data, `step_${step}_client_failures`),
            server: values(data, `step_${step}_server_failures`),
            unexpected: values(data, `step_${step}_unexpected_failures`),
            status: values(data, `step_${step}_failure_status`),
            errorCode: values(data, `step_${step}_failure_error_code`),
          },
        ]),
      ),
    },
  };

  const resultPath =
    __ENV.SAPLING_RESULT_PATH || `summary-${String(USERS)}.json`;
  return {
    [resultPath]: JSON.stringify(result, null, 2),
    stdout: summaryText(result),
  };
}

function values(data, metricNameValue) {
  return data.metrics[metricNameValue]?.values ?? null;
}

function thresholdsPassed(metrics) {
  return Object.values(metrics).every((metric) =>
    Object.values(metric.thresholds || {}).every(
      (threshold) => threshold.ok !== false,
    ),
  );
}

function summaryText(result) {
  const duration = result.metrics.httpRequestDuration || {};
  const workflows = result.metrics.workflowSuccess || {};
  const failures = result.metrics.httpRequestFailed || {};
  return [
    "",
    `Sapling workflow load test: ${result.config.users} users`,
    `Workflows: ${result.metrics.iterations?.count ?? 0}/${result.config.expectedWorkflows}`,
    `Workflow success: ${percent(workflows.rate)}`,
    `HTTP error rate: ${percent(failures.rate)}`,
    `Request failures: ${result.failureDiagnostics.total?.count ?? 0} (transport ${result.failureDiagnostics.transport?.count ?? 0}, 4xx ${result.failureDiagnostics.client?.count ?? 0}, 5xx ${result.failureDiagnostics.server?.count ?? 0}, other ${result.failureDiagnostics.unexpected?.count ?? 0})`,
    `HTTP duration: avg ${milliseconds(duration.avg)}, p95 ${milliseconds(duration["p(95)"])}, p99 ${milliseconds(duration["p(99)"])}`,
    `Thresholds: ${result.thresholdsPassed ? "passed" : "failed"}`,
    "",
  ].join("\n");
}

function percent(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "n/a";
}

function milliseconds(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} ms` : "n/a";
}
