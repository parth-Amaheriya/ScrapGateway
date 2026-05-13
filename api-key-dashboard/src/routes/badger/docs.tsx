
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { issueApi, type IssueImagePayload, type IssueRecord } from "@/api/issues";
import { toast } from "sonner";

export const Route = createFileRoute("/badger/docs")({
  head: () => ({
    meta: [
      { title: "API Documentation — Scraping Gateway" },
      {
        name: "description",
        content:
          "Developer documentation for the protected multi-tenant FastAPI scraping gateway: authentication, quotas, proxy rotation, endpoints, and error handling.",
      },
      { property: "og:title", content: "API Documentation — Scraping Gateway" },
      {
        property: "og:description",
        content:
          "Deep developer documentation for the FastAPI scraping API: endpoints, governance, proxy rotation, Redis keys.",
      },
    ],
  }),
  component: DocsPage,
});

/* ---------- helpers ---------- */
function CopyButton({ text }: { text: string }) {

  async function copyToClipboard(text: string): Promise<boolean> {
    if (!text) return false;

    try {
      // Primary: Modern Clipboard API
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback: execCommand method
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-999999px";
        textarea.style.top = "-999999px";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand("copy");
        document.body.removeChild(textarea);
        return success;
      } catch (err) {
        console.error("Copy failed:", err);
        return false;
      }
    }
  }
  
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  const handleCopy = async () => {
    if (!text) return;

    const success = await copyToClipboard(text);

    if (success) {
      setStatus("copied");
    } else {
      setStatus("failed");
    }

    setTimeout(() => setStatus("idle"), 1800);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 rounded-md border border-[var(--docs-border)] bg-[var(--docs-surface)] px-2 py-1 font-mono text-[11px] text-[var(--docs-muted)] hover:text-[var(--docs-fg)] hover:border-[var(--docs-accent)] transition-colors"
      aria-label="Copy code"
    >
      {status === "copied" && "copied"}
      {status === "failed" && "❌ failed"}
      {status === "idle" && "copy"}
    </button>
  );
}

function Code({ code, lang = "bash" }: { code: string; lang?: string }) {
  return (
    <div className="relative my-4">
      <div className="flex items-center justify-between border border-b-0 border-[var(--docs-border)] bg-[var(--docs-surface-2)] px-3 py-1.5 rounded-t-md">
        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--docs-muted)]">
          {lang}
        </span>
      </div>
      <pre className="m-0 overflow-x-auto rounded-b-md border border-[var(--docs-border)] bg-[var(--docs-code-bg)] p-4 font-mono text-[13px] leading-relaxed text-[var(--docs-fg)]">
        <code>{code}</code>
      </pre>
      <CopyButton text={code} />
    </div>
  );
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 py-10 border-b border-[var(--docs-border)]">
      {eyebrow && (
        <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--docs-accent)]">
          {eyebrow}
        </div>
      )}
      <h2 className="text-2xl font-semibold tracking-tight text-[var(--docs-fg)]">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--docs-fg-soft)]">
        {children}
      </div>
    </section>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[var(--docs-border)] bg-[var(--docs-surface)] p-4">
      <div className="mb-1 font-semibold text-[var(--docs-fg)]">{title}</div>
      <div className="text-sm text-[var(--docs-fg-soft)] leading-6">{children}</div>
    </div>
  );
}

function Method({ m }: { m: "GET" | "POST" }) {
  const color =
    m === "GET" ? "text-[var(--docs-accent)] border-[var(--docs-accent)]" : "text-[var(--docs-amber)] border-[var(--docs-amber)]";
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${color}`}
    >
      {m}
    </span>
  );
}

function Field({
  name,
  type,
  required,
  children,
}: {
  name: string;
  type: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-[var(--docs-border)] py-3 first:border-t-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <code className="font-mono text-sm text-[var(--docs-fg)]">{name}</code>
        <span className="font-mono text-xs text-[var(--docs-muted)]">{type}</span>
        {required ? (
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--docs-amber)]">
            required
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--docs-muted)]">
            optional
          </span>
        )}
      </div>
      <div className="mt-1 text-sm leading-6 text-[var(--docs-fg-soft)]">{children}</div>
    </div>
  );
}

/* ---------- nav ---------- */

const NAV: { group: string; items: { id: string; label: string }[] }[] = [
  {
    group: "Overview",
    items: [
      { id: "introduction", label: "Introduction" },
      { id: "highlights", label: "Highlights" },
      { id: "how-it-works", label: "How it works" },
    ],
  },
  {
    group: "Concepts",
    items: [
      { id: "authentication", label: "Authentication" },
      { id: "governance", label: "Governance" },
      { id: "proxy-rotation", label: "Proxy Rotation" },
      { id: "quota-balance", label: "Quota & Balance" },
      { id: "error-handling", label: "Error Handling" },
    ],
  },
  {
    group: "API Reference",
    items: [
      { id: "endpoint-scrape", label: "POST /scrape" },
      { id: "endpoint-balance", label: "GET /balance" },
      { id: "endpoint-limits", label: "GET /limits" },
    ],
  },
  {
    group: "Examples",
    items: [
      { id: "example-curl", label: "cURL" },
      { id: "example-python", label: "Python" },
      { id: "example-js", label: "JavaScript" },
      { id: "example-payload", label: "JSON payload" },
    ],
  },
  {
    group: "Operations",
    items: [
      { id: "errors", label: "Errors & Status Codes" },
      { id: "redis", label: "Redis Keys" },
      { id: "security", label: "Security Notes" },
      { id: "gotchas", label: "Implementation Gotchas" },
    ],
  },
];

/* ---------- page ---------- */

function DocsPage() {
  const [active, setActive] = useState("introduction");
  const [issueOpen, setIssueOpen] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackIssueId, setTrackIssueId] = useState("");
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mainRef.current) return;
    const ids = NAV.flatMap((g) => g.items.map((i) => i.id));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { root: mainRef.current, rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="docs-theme h-screen flex flex-col overflow-hidden bg-[var(--docs-bg)] text-[var(--docs-fg)]">
      <style>{`
        .docs-theme {
          --docs-bg: oklch(0.985 0.012 85);
          --docs-surface: oklch(0.995 0.008 85);
          --docs-surface-2: oklch(0.965 0.014 85);
          --docs-code-bg: oklch(0.97 0.012 85);
          --docs-fg: oklch(0.22 0.02 60);
          --docs-fg-soft: oklch(0.36 0.018 60);
          --docs-muted: oklch(0.55 0.015 60);
          --docs-border: oklch(0.89 0.018 75);
          --docs-accent: oklch(0.5 0.09 145);
          --docs-amber: oklch(0.62 0.13 65);
          --docs-danger: oklch(0.52 0.16 25);
          font-family: ui-sans-serif, -apple-system, "Segoe UI", "Helvetica Neue", sans-serif;
        }
        .docs-theme code, .docs-theme pre {
          font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
        }
      `}</style>

      {/* Header */}
      <header className="shrink-0 border-b border-[var(--docs-border)] bg-[var(--docs-bg)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-sm bg-[var(--docs-accent)]" />
            <span className="font-mono text-sm font-semibold tracking-tight">
              scraping-gateway
            </span>
            <span className="ml-2 font-mono text-[11px] text-[var(--docs-muted)]">
              v1 · docs
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIssueOpen(true)}
            className="rounded-md border border-[var(--docs-amber)] bg-[var(--docs-surface-2)] px-3 py-1.5 font-mono text-xs text-[var(--docs-fg)] transition-colors" >
            Raise an Issue
          </button>
          <button
            type="button"
            onClick={() => {
              setTrackIssueId("");
              setTrackOpen(true);
            }}
            className="ml-2 rounded-md border border-[var(--docs-border)] bg-[var(--docs-surface)] px-3 py-1.5 font-mono text-xs text-[var(--docs-fg-soft)] transition-colors hover:text-[var(--docs-fg)]"
          >
            Track Issue
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="hidden lg:block w-60 shrink-0 overflow-y-auto border-r border-stone-200 py-10 pl-6 pr-4">
          <nav className="space-y-6">
            {NAV.map((group) => (
              <div key={group.group}>
                <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--docs-muted)]">
                  {group.group}
                </div>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className={`block rounded px-2 py-1 text-sm transition-colors ${active === item.id
                          ? "bg-[var(--docs-surface-2)] text-[var(--docs-fg)] border-l-2 border-[var(--docs-accent)]"
                          : "text-[var(--docs-fg-soft)] hover:text-[var(--docs-fg)]"
                          }`}
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <main
          ref={mainRef}
          className="min-w-0 flex-1 overflow-y-auto px-6 py-8 lg:pl-10"
        >
          <div
            role="alert"
            className="mb-6 rounded-md border border-[var(--docs-amber)]/50 bg-[oklch(0.96_0.04_80)] px-4 py-3 text-sm text-[oklch(0.36_0.08_60)]"
          >
            <p className="font-bold">
              ⚠️ CAUTION: EXPERIMENTAL SYSTEM
            </p>

            <p className="mt-2">
              This API is currently in its Pilot Testing phase. The system is
              undergoing rapid development, and you should expect frequent updates.
              Breaking changes to request schemas, authentication logic, or Redis
              infrastructure may occur without prior notice.
            </p>

            <p className="mt-3 font-semibold">
              Reporting Failures & Bugs
            </p>

            <p className="mt-1">
              To help us stabilize the engine, please report any unexpected errors,
              proxy timeouts, latency lags, quota exhaustion, blocking, or performance
              bottlenecks directly to me:
            </p>

            <div className="mt-3 space-y-1">
              <p>
                <span className="font-semibold">Email:</span>{" "}
                bhargav.joshi@actowiz.co.in
              </p>

              <p>
                <span className="font-semibold">Slack:</span>{" "}
                https://actowizsolutions41121.slack.com/team/U05C0FGPB50
              </p>

              <p>
                <span className="font-semibold">Phone/WhatsApp:</span>{" "}
                +91 9824818225
              </p>
            </div>
          </div>

          <div className="mb-10">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--docs-accent)]">
              Documentation
            </div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              Scraping Gateway API
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[var(--docs-fg-soft)]">
              A protected, multi-tenant FastAPI scraping gateway with API-key
              governance, per-project quotas, concurrency limits, allowed-domain
              enforcement, and rotating proxies executed asynchronously through{" "}
              <code className="rounded bg-[var(--docs-surface-2)] px-1 py-0.5 text-[13px]">
                curl_cffi
              </code>
              .
            </p>
          </div>

          {/* Introduction */}
          <Section id="introduction" eyebrow="Overview" title="What this API does">
            <p>
              The Scraping Gateway is a server-side facade in front of arbitrary
              HTTP targets. Clients never talk to the target site directly —
              they hand the request to the gateway, which authenticates the
              caller, validates the target, charges quota, picks a proxy from
              the project&rsquo;s rotation pool, and executes the request on
              their behalf.
            </p>
            <p>
              Every caller belongs to a <em>project</em>. Projects are isolated:
              they have their own allowed-domain list, their own quota balance,
              their own concurrency budget, and their own proxy rotator with
              independent health tracking. A misbehaving project cannot starve
              another project of proxies or capacity.
            </p>
          </Section>

          {/* Highlights */}
          <Section id="highlights" title="Highlights">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card title="Protected gateway">
                All traffic requires a valid <code>x-api-key</code>. Unknown
                keys are rejected before any work is done.
              </Card>
              <Card title="API-key based projects">
                Keys are mapped 1:N to projects in Redis; the project record
                drives every downstream policy decision.
              </Card>
              <Card title="Allowed-domain validation">
                Each project declares the domains it may scrape. Anything else
                is refused with a 403.
              </Card>
              <Card title="Per-project quota">
                Requests are debited from a Redis counter before execution, so
                bursts cannot overshoot the budget.
              </Card>
              <Card title="Per-project concurrency">
                A live <code>active_conn</code> counter caps how many in-flight
                requests a project may hold at once.
              </Card>
              <Card title="Proxy rotation & health">
                Each project has its own rotator that records success and
                failure on every attempt and demotes unhealthy proxies.
              </Card>
              <Card title="Async execution">
                Targets are fetched with <code>curl_cffi.AsyncSession</code>{" "}
                for HTTP/2, browser-grade TLS fingerprinting and high
                throughput.
              </Card>
              <Card title="Content verification">
                An optional <code>contains</code> check turns a 200 with the
                wrong body into a proxy failure, not a success.
              </Card>
            </div>
          </Section>

          {/* How it works */}
          <Section id="how-it-works" eyebrow="Lifecycle" title="How a request flows">
            <p>
              The exact order of operations matters — it is what guarantees
              quota safety, fair concurrency, and accurate proxy health
              accounting.
            </p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Client sends <code>POST /scrape</code> with{" "}
                <code>x-api-key</code> and a JSON body describing the target.
              </li>
              <li>
                Gateway looks up <code>auth_key:&#123;api_key&#125;</code> in
                Redis to resolve a <code>project_id</code>. Missing → 401.
              </li>
              <li>
                Gateway loads <code>project_meta:&#123;project_id&#125;</code>{" "}
                (allowed domains, concurrency cap, proxy pool ref). Missing → 404.
              </li>
              <li>
                The host of <code>url</code> is matched against the project&rsquo;s
                allowed-domain list. Mismatch → 403.
              </li>
              <li>
                <code>active_conn:&#123;project_id&#125;</code> is incremented;
                if it exceeds the project&rsquo;s cap, decrement and return 429.
              </li>
              <li>
                <code>quota:&#123;project_id&#125;</code> is decremented{" "}
                <em>before</em> the outbound request. If it would go negative,
                refund and return 403.
              </li>
              <li>
                A proxy is selected from the project&rsquo;s rotator (least
                recently failed, healthy first).
              </li>
              <li>
                The target request is executed via{" "}
                <code>curl_cffi.AsyncSession</code> using the chosen proxy.
              </li>
              <li>
                On success the proxy is marked healthy. On transport failure,
                or on a failed <code>contains</code> check, the proxy is marked
                failed.
              </li>
              <li>
                In a <code>finally</code> block,{" "}
                <code>active_conn:&#123;project_id&#125;</code> is decremented
                so the slot is always released.
              </li>
            </ol>
          </Section>

          {/* Authentication */}
          <Section id="authentication" eyebrow="Concepts" title="Authentication">
            <p>
              Authentication is a single header:{" "}
              <code>x-api-key: &lt;your_key&gt;</code>. The gateway never reads
              the key from query strings, cookies, or the request body. Treat
              the key as a bearer secret — anyone holding it can spend the
              project&rsquo;s quota.
            </p>
            <p>
              Internally the key is resolved to a project through the Redis
              key <code>auth_key:&#123;api_key&#125;</code>. Rotating a key
              means deleting the old mapping and creating a new one; the
              project&rsquo;s quota and proxy pool are unaffected.
            </p>
          </Section>

          {/* Governance */}
          <Section id="governance" title="Governance">
            <p>
              Governance is the layer that decides whether a request is even
              allowed to leave the gateway. It runs in a strict order:
              authentication → project lookup → domain check → concurrency
              check → quota debit. Each stage can short-circuit the request
              with a specific status code; see <a className="underline" href="#errors">Errors &amp; Status Codes</a>.
            </p>
            <p>
              Allowed domains are matched on the request URL&rsquo;s host. Subdomain
              matching follows the project configuration — be explicit: list
              every host you intend to scrape.
            </p>
          </Section>

          {/* Proxy rotation */}
          <Section id="proxy-rotation" title="Proxy Rotation">
            <p>
              Each project owns an isolated rotator. A rotator picks the next
              proxy on each call and exposes two callbacks:{" "}
              <code>report_success(proxy)</code> and{" "}
              <code>report_failure(proxy)</code>. Health is local to the
              project — a proxy that misbehaves on Project A will not be
              demoted for Project B.
            </p>
            <p>
              A failure is recorded for any of: connection error, timeout,
              non-2xx status from the target, or a failed{" "}
              <code>contains</code> check (the upstream returned a body that
              does not include the expected substring — a strong signal of a
              soft block).
            </p>
          </Section>

          {/* Quota */}
          <Section id="quota-balance" title="Quota & Balance">
            <p>
              Quota is a Redis integer at{" "}
              <code>quota:&#123;project_id&#125;</code>. It is decremented{" "}
              <em>before</em> the outbound request to make over-spending
              impossible under concurrency. If the request fails for a
              gateway-side reason (e.g. concurrency cap), the quota is
              refunded; if the upstream itself fails, the quota stays spent —
              you paid for the attempt.
            </p>
            <p>
              Use <code>GET /balance/&#123;api_key&#125;</code> to read the
              remaining quota and <code>GET /limits/&#123;api_key&#125;</code>{" "}
              to inspect concurrency and domain configuration.
            </p>
          </Section>

          {/* Error handling */}
          <Section id="error-handling" title="Error Handling">
            <p>
              The gateway returns HTTP status codes that reflect{" "}
              <em>where</em> the failure happened: <code>4xx</code> for caller
              problems (auth, config, policy), <code>429</code> for in-flight
              concurrency, and <code>5xx</code> for gateway/proxy/target
              failures. The body is always JSON with a stable shape — see{" "}
              <a className="underline" href="#errors">Errors &amp; Status Codes</a>.
            </p>
            <p>
              A special case is <code>partial_failure</code>: the upstream
              returned 200 but the optional <code>contains</code> assertion did
              not match. The gateway reports this as a failure so the proxy is
              demoted and the caller can retry.
            </p>
          </Section>

          {/* Endpoint: /scrape */}
          <Section id="endpoint-scrape" eyebrow="API Reference" title="POST /scrape">
            <div className="flex items-center gap-3">
              <Method m="POST" />
              <code className="font-mono text-[15px]">/scrape</code>
            </div>
            <p>
              Execute an authenticated, proxied request against an allowed
              target. This is the primary endpoint of the gateway.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Card title="Required headers">
                <code>x-api-key: &lt;your_key&gt;</code>
                <br />
                <code>content-type: application/json</code>
              </Card>
              <Card title="Behavior">
                Validates the key, debits quota, picks a proxy, performs the
                request asynchronously, reports proxy health, returns the
                upstream body.
              </Card>
            </div>

            <h3 className="mt-6 text-lg font-semibold text-[var(--docs-fg)]">
              Request body
            </h3>
            <div className="mt-2 rounded-md border border-[var(--docs-border)] bg-[var(--docs-surface)] px-4">
              <Field name="url" type="string" required>
                Absolute URL of the target. Its host must appear in the
                project&rsquo;s allowed-domain list.
              </Field>
              <Field name="method" type='string ("GET" | "POST" | …)'>
                HTTP method to perform against the target. Defaults to{" "}
                <code>GET</code>.
              </Field>
              <Field name="headers" type="object">
                Headers forwarded to the target. The gateway may add or
                override transport-level headers (e.g. proxy auth) but caller
                headers take precedence for request semantics.
              </Field>
              <Field name="params" type="object">
                Query-string parameters merged into <code>url</code>.
              </Field>
              <Field name="data" type="string | object">
                Form-encoded body for the upstream request. Mutually exclusive
                with <code>json</code>.
              </Field>
              <Field name="json" type="object">
                JSON body for the upstream request. Sets the upstream{" "}
                <code>content-type</code> automatically.
              </Field>
              <Field name="contains" type="string">
                If provided, the response body must contain this substring.
                Otherwise the gateway treats the attempt as a proxy failure
                (<code>partial_failure</code>) and reports the proxy as bad.
              </Field>

              <Field name="contains" type="string">
                custom_headers (boolean)
                Allows overriding or adding custom request headers provided in the headers object.
                When enabled, the provided headers are merged with the default headers.
                <br /><b>Note:</b> Cookies can also be sent using the "cookies" key inside the headers object.
              </Field>
            </div>

            <h3 className="mt-6 text-lg font-semibold text-[var(--docs-fg)]">
              Example request
            </h3>
            <Code
              lang="http"
              code={`POST /scrape HTTP/1.1
Host: api.example.com
x-api-key: sk_live_abc123
content-type: application/json

{
  "url": "https://target.example.com/products",
  "method": "GET",
  "headers": { "accept": "text/html" },
  "params": { "page": 2 },
  "contains": "<title>Products"
}`}
            />

            <h3 className="mt-6 text-lg font-semibold text-[var(--docs-fg)]">
              Success response
            </h3>
            <Code
              lang="json"
              code={`HTTP/1.1 200 OK
content-type: application/json

{
  "status": "ok",
  "status_code": 200,
  "proxy": "proxy-12.pool.internal:8000",
  "body": "<!doctype html><html>…</html>"
}`}
            />
            <p className="text-sm text-[var(--docs-muted)]">
              Note: the current implementation returns the raw upstream{" "}
              <code>response.text</code> as <code>body</code>. Binary targets
              should be decoded by the caller.
            </p>

            <h3 className="mt-6 text-lg font-semibold text-[var(--docs-fg)]">
              Error response
            </h3>
            <Code
              lang="json"
              code={`HTTP/1.1 403 Forbidden
content-type: application/json

{
  "status": "error",
  "error": "domain_not_allowed",
  "detail": "host 'evil.example.com' is not in the allowed list"
}`}
            />
          </Section>

          {/* Endpoint: /balance */}
          <Section id="endpoint-balance" title="GET /balance/{api_key}">
            <div className="flex items-center gap-3">
              <Method m="GET" />
              <code className="font-mono text-[15px]">/balance/&#123;api_key&#125;</code>
            </div>
            <p>
              Returns the remaining quota for the project that owns the given
              API key. Useful for dashboards and pre-flight checks.
            </p>
            <Code
              lang="bash"
              code={`curl https://api.example.com/balance/sk_live_abc123`}
            />
            <Code
              lang="json"
              code={`{
  "project_id": "test2",
  "remaining_quota": 1000,
  "live_concurrency": 0
}`}
            />
            <Code
              lang="json"
              code={`HTTP/1.1 401 Unauthorized

{ "status": "error", "error": "invalid_api_key" }`}
            />
            <p className="text-sm text-[var(--docs-muted)]">
              The key in the path is treated as a lookup, not as
              authentication for an action — but it still must exist. Do not
              expose this endpoint to untrusted clients without rate limiting.
            </p>
          </Section>

          {/* Endpoint: /limits */}
          <Section id="endpoint-limits" title="GET /limits/{api_key}">
            <div className="flex items-center gap-3">
              <Method m="GET" />
              <code className="font-mono text-[15px]">/limits/&#123;api_key&#125;</code>
            </div>
            <p>
              Returns the project&rsquo;s policy: maximum concurrency, current
              in-flight count, and the allowed-domain list.
            </p>
            <Code
              lang="bash"
              code={`curl https://api.example.com/limits/sk_live_abc123`}
            />
            <Code
              lang="json"
              code={`{
  "project_id": "test2",
  "pool_size": "5000",
  "cost_per_request": "1.0",
  "recovery_per_second": "4.9",
  "penalty_increase": "2.0",
  "total_quota": "1000",
  "average_latency": "2.0",
  "failure_rate": "0.39",
  "safety_margin": "0.2",
  "allowed_domains": [
      "amazon.com",
      "flipkart.com",
      "croma.com"
    ],
  "api_key": "sk_38a3d450f9eabdd19c1e39d520719a82",
  "status": "active",
  "quota_limit": "1000",
  "expected_latency": "2.0",
  "max_concurrency": "183",
  "max_rps": "91.54",
  "failure_rate_assumption": "0.39",
  "safety_level": "0.2",
  "hits_per_proxy": "0.2",
  "etc_minutes": "0.18"
}`}
            />
          </Section>

          {/* cURL example */}
          <Section id="example-curl" eyebrow="Examples" title="cURL">
            <Code
              lang="bash"
              code={`curl -X POST https://api.example.com/scrape \\
  -H "x-api-key: sk_live_abc123" \\
  -H "content-type: application/json" \\
  -d '{
    "url": "https://target.example.com/products",
    "method": "GET",
    "params": { "page": 2 },
    "contains": "<title>Products"
  }'`}
            />
          </Section>

          {/* Python example */}
          <Section id="example-python" title="Python (requests)">
            <Code
              lang="python"
              code={`import requests

resp = requests.post(
    "https://api.example.com/scrape",
    headers={"x-api-key": "sk_live_abc123"},
    json={
        "url": "https://target.example.com/products",
        "method": "GET",
        "params": {"page": 2},
        "contains": "<title>Products",
    },
    timeout=60,
)
resp.raise_for_status()
data = resp.json()
print(data["status_code"], data["proxy"])`}
            />
          </Section>

          {/* JS example */}
          <Section id="example-js" title="JavaScript (fetch)">
            <Code
              lang="javascript"
              code={`const res = await fetch("https://api.example.com/scrape", {
  method: "POST",
  headers: {
    "x-api-key": "sk_live_abc123",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    url: "https://target.example.com/products",
    method: "GET",
    params: { page: 2 },
    contains: "<title>Products",
  }),
});

if (!res.ok) throw new Error(\`gateway error: \${res.status}\`);
const data = await res.json();
console.log(data.status_code, data.proxy);`}
            />
          </Section>

          {/* JSON payload */}
          <Section id="example-payload" title="Example JSON payload">
            <Code
              lang="json"
              code={`{
  "url": "https://target.example.com/api/items",
  "method": "POST",
  "headers": {
    "accept": "application/json",
    "user-agent": "my-bot/1.0"
  },
  "params": { "locale": "en" },
  "json": { "filter": { "in_stock": true } },
  "contains": "\\"items\\":"
}`}
            />
          </Section>

          {/* Errors */}
          <Section id="errors" eyebrow="Operations" title="Errors & Status Codes">
            <div className="overflow-x-auto rounded-md border border-[var(--docs-border)]">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[var(--docs-surface-2)] text-left">
                  <tr>
                    <th className="px-3 py-2 font-mono text-xs uppercase tracking-wider text-[var(--docs-muted)]">
                      Status
                    </th>
                    <th className="px-3 py-2 font-mono text-xs uppercase tracking-wider text-[var(--docs-muted)]">
                      Error
                    </th>
                    <th className="px-3 py-2 font-mono text-xs uppercase tracking-wider text-[var(--docs-muted)]">
                      Meaning
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--docs-border)]">
                  {[
                    [
                      "401",
                      "invalid_api_key",
                      "x-api-key missing or no auth_key:{key} mapping in Redis. Caller must re-issue a valid key.",
                    ],
                    [
                      "404",
                      "project_not_found",
                      "Key resolved to a project_id but project_meta:{id} is missing. Configuration drift; contact ops.",
                    ],
                    [
                      "403",
                      "domain_not_allowed",
                      "Target host is not in the project's allowed-domain list. The request never leaves the gateway.",
                    ],
                    [
                      "429",
                      "concurrency_limit_reached",
                      "active_conn:{id} is at the project's cap. Retry with backoff; quota is NOT debited.",
                    ],
                    [
                      "403",
                      "quota_exhausted",
                      "quota:{id} would go below zero. Top up balance or wait for reset.",
                    ],
                    [
                      "502",
                      "remote_server_error",
                      "Upstream returned a non-2xx response. Proxy is reported failed; quota stays spent.",
                    ],
                    [
                      "500",
                      "proxy_error / request_error / internal_error",
                      "Transport failure (connection, TLS, timeout) or unhandled gateway exception. Proxy reported failed.",
                    ],
                    [
                      "200 / 502",
                      "partial_failure",
                      "Upstream returned 200 but the contains check did not match. Treated as a soft block; proxy demoted.",
                    ],
                  ].map(([s, e, m]) => (
                    <tr key={e} className="bg-[var(--docs-surface)]">
                      <td className="px-3 py-2 font-mono text-[13px] text-[var(--docs-fg)]">
                        {s}
                      </td>
                      <td className="px-3 py-2 font-mono text-[13px] text-[var(--docs-amber)]">
                        {e}
                      </td>
                      <td className="px-3 py-2 text-[var(--docs-fg-soft)]">{m}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Redis */}
          <Section id="redis" title="Redis Keys">
            <p>
              All shared state lives in Redis. The gateway is otherwise
              stateless and horizontally scalable.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card title="auth_key:{api_key}">
                Maps an API key to its <code>project_id</code>. Lookup happens
                on every request; missing → 401.
              </Card>
              <Card title="project_meta:{project_id}">
                Project configuration: allowed domains, concurrency cap,
                proxy-pool reference. Missing → 404.
              </Card>
              <Card title="active_conn:{project_id}">
                Live counter of in-flight requests. Incremented on entry,
                decremented in <code>finally</code>. Compared against the
                project&rsquo;s concurrency cap.
              </Card>
              <Card title="quota:{project_id}">
                Remaining request budget. Debited <em>before</em> the outbound
                call; refunded only when the gateway itself rejects the
                request.
              </Card>
            </div>
          </Section>

          {/* Security */}
          <Section id="security" title="Security Notes">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Send the API key only in the <code>x-api-key</code> header.
                Never put it in query strings, URLs, or client-side bundles.
              </li>
              <li>
                Never expose the Redis password, the proxy list, or proxy
                credentials to the frontend. The gateway is the only component
                that should know them.
              </li>
              <li>
                Quotas and concurrency caps are the primary abuse controls — do
                not disable them in production, even temporarily.
              </li>
              <li>
                Allowed-domain enforcement is what stops the gateway from
                becoming an open proxy. Treat additions to the list as a
                security-sensitive change.
              </li>
              <li>
                Consider TLS termination, IP allow-lists, and request logging
                with PII redaction at the edge in front of the gateway.
              </li>
            </ul>
          </Section>

          {/* Gotchas */}
          <Section id="gotchas" title="Implementation Gotchas">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>active_conn</strong> must always decrement in a{" "}
                <code>finally</code> block. Skipping this on an exception path
                permanently leaks concurrency until the key expires or is reset.
              </li>
              <li>
                <strong>Quota is debited before the request.</strong> This is
                deliberate — it makes overshoot impossible under concurrency.
                The trade-off is that failed upstream calls still cost quota.
              </li>
              <li>
                A failed <code>contains</code> check must be reported as a{" "}
                <em>proxy failure</em>, not a success. This is what lets the
                rotator demote proxies that are being soft-blocked by the
                target.
              </li>
              <li>
                Proxy rotators are <em>per project</em>. A proxy demoted for
                Project A is still healthy for Project B until it fails there
                too. Do not collapse them into a single global rotator.
              </li>
              <li>
                The success response currently returns raw{" "}
                <code>response.text</code>. Binary content (images, PDFs) will
                be lossy — add a base64 mode if you need it.
              </li>
            </ul>
          </Section>

          <footer className="py-10 text-center font-mono text-xs text-[var(--docs-muted)]">
            scraping-gateway · internal developer documentation
          </footer>
        </main>
      </div>

      {issueOpen && (
        <IssueModal
          onClose={() => setIssueOpen(false)}
          onTrackIssue={(issueId) => {
            setIssueOpen(false);
            setTrackIssueId(issueId);
            setTrackOpen(true);
          }}
        />
      )}
      {trackOpen && (
        <TrackIssueModal
          initialIssueId={trackIssueId}
          onClose={() => setTrackOpen(false)}
        />
      )}
    </div>
  );
}

function IssueModal({
  onClose,
  onTrackIssue,
}: {
  onClose: () => void;
  onTrackIssue: (issueId: string) => void;
}) {
  const [domain, setDomain] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [createdIssue, setCreatedIssue] = useState<IssueRecord | null>(null);
  const [issueCopied, setIssueCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null); useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const urls = images.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [images]);

  const fileToPayload = (file: File): Promise<IssueImagePayload> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          name: file.name,
          type: file.type,
          data: String(reader.result ?? ""),
        });
      };
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });

  const addFiles = (files: FileList | File[]) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setImages((prev) => [...prev, ...imgs]);
  };

  const removeImage = (i: number) =>
    setImages((prev) => prev.filter((_, idx) => idx !== i));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!domain.trim()) e.domain = "Domain is required";
    if (!apiKey.trim()) e.apiKey = "API key is required";
    if (!email.trim()) e.email = "Developer email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      e.email = "Enter a valid email";
    if (!description.trim()) e.description = "Description is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const imagePayload = await Promise.all(images.map((file) => fileToPayload(file)));
      const created = await issueApi.create({
        domain: domain.trim(),
        api_key: apiKey.trim(),
        email: email.trim(),
        description: description.trim(),
        images: imagePayload,
        source: "docs",
      });
      setCreatedIssue(created);
      toast.success("Issue submitted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit issue");
    } finally {
      setSubmitting(false);
    }
  };
  /* ---------- Copy Utility ---------- */
  async function copyToClipboard(text: string): Promise<boolean> {
    if (!text) return false;

    try {
      // Primary: Modern Clipboard API
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback: execCommand method
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-999999px";
        textarea.style.top = "-999999px";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand("copy");
        document.body.removeChild(textarea);
        return success;
      } catch (err) {
        console.error("Copy failed:", err);
        return false;
      }
    }
  }
  const inputCls =
    "w-full rounded-md border border-[var(--docs-border)] bg-[var(--docs-surface)] px-3 py-2 font-mono text-[13px] text-[var(--docs-fg)] placeholder:text-[var(--docs-muted)] focus:outline-none focus:border-[var(--docs-amber)] focus:ring-1 focus:ring-[var(--docs-amber)]/40 transition-colors";
  const labelCls =
    "mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-[var(--docs-muted)]";
  const errCls = "mt-1 font-mono text-[11px] text-[var(--docs-danger)]";

  return (
    <div
      className="docs-theme fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="issue-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-[var(--docs-border)] bg-[var(--docs-bg)] shadow-md">
        <div className="flex items-center justify-between border-b border-[var(--docs-border)] px-5 py-3">
          <h3
            id="issue-modal-title"
            className="text-base font-semibold text-[var(--docs-fg)]"
          >
            Report an Issue
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 font-mono text-sm text-[var(--docs-muted)] hover:text-[var(--docs-fg)]"
          >
            ✕
          </button>
        </div>

        {createdIssue ? (
          <div className="px-5 py-5 space-y-4">
            <div className="rounded-md border border-[var(--docs-border)] bg-[var(--docs-surface-2)] p-4">
              <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--docs-muted)]">
                Issue submitted
              </div>
              <div className="mt-2 break-all font-mono text-sm text-[var(--docs-fg)]">
                {createdIssue.issue_id}
              </div>
              <div className="mt-2 text-sm leading-6 text-[var(--docs-fg-soft)]">
                Save this issue id to check status later.
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--docs-border)] pt-4">
              <button
                type="button"
                onClick={async () => {
                  const success = await copyToClipboard(createdIssue.issue_id);

                  if (success) {
                    setIssueCopied(true);

                    if (copyTimeoutRef.current) {
                      window.clearTimeout(copyTimeoutRef.current);
                    }

                    copyTimeoutRef.current = window.setTimeout(() => {
                      setIssueCopied(false);
                    }, 1800);

                    toast.success("Issue ID copied to clipboard");
                  } else {
                    toast.error("Failed to copy issue ID");
                  }
                }}
                className="rounded-md border border-[var(--docs-border)] bg-[var(--docs-surface)] px-3 py-1.5 font-mono text-xs text-[var(--docs-fg-soft)] hover:text-[var(--docs-fg)] hover:bg-[var(--docs-surface-2)] transition-colors"
              >
                {issueCopied ? "✅ Copied" : "Copy Issue ID"}
              </button>
              <button
                type="button"
                onClick={() => onTrackIssue(createdIssue.issue_id)}
                className="rounded-md border border-[var(--docs-amber)] bg-[var(--docs-amber)] px-3 py-1.5 font-mono text-xs font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Track Issue Status
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-[var(--docs-border)] bg-[var(--docs-surface)] px-3 py-1.5 font-mono text-xs text-[var(--docs-fg-soft)] hover:text-[var(--docs-fg)] hover:bg-[var(--docs-surface-2)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <div>
              <label className={labelCls}>Domain</label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                className={inputCls}
              />
              {errors.domain && <div className={errCls}>{errors.domain}</div>}
            </div>

            <div>
              <label className={labelCls}>API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
                className={inputCls}
                autoComplete="off"
              />
              {errors.apiKey && <div className={errCls}>{errors.apiKey}</div>}
            </div>

            <div>
              <label className={labelCls}>Developer Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@example.com"
                className={inputCls}
              />
              {errors.email && <div className={errCls}>{errors.email}</div>}
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the issue in detail..."
                rows={4}
                className={`${inputCls} resize-y leading-6`}
              />
              {errors.description && (
                <div className={errCls}>{errors.description}</div>
              )}
            </div>

            <div>
              <label className={labelCls}>Images (Optional)</label>
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-6 text-center transition-colors ${dragOver
                  ? "border-[var(--docs-amber)] bg-[var(--docs-surface-2)]"
                  : "border-[var(--docs-border)] bg-[var(--docs-surface)] hover:bg-[var(--docs-surface-2)]"
                  }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && addFiles(e.target.files)}
                />
                <div className="font-mono text-xs text-[var(--docs-fg-soft)]">
                  Drag &amp; drop images here, or click to select
                </div>
                <div className="mt-1 font-mono text-[11px] text-[var(--docs-muted)]">
                  PNG, JPG, GIF — multiple allowed
                </div>
              </label>

              {previews.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {previews.map((src, i) => (
                    <div
                      key={i}
                      className="group relative aspect-square overflow-hidden rounded border border-[var(--docs-border)] bg-[var(--docs-surface)]"
                    >
                      <img
                        src={src}
                        alt={`upload-${i}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Remove image"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--docs-border)] pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-[var(--docs-border)] bg-[var(--docs-surface)] px-3 py-1.5 font-mono text-xs text-[var(--docs-fg-soft)] hover:text-[var(--docs-fg)] hover:bg-[var(--docs-surface-2)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md border border-[var(--docs-amber)] bg-[var(--docs-amber)] px-3 py-1.5 font-mono text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {submitting ? "Submitting..." : "Submit Issue"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function TrackIssueModal({
  initialIssueId,
  onClose,
}: {
  initialIssueId?: string;
  onClose: () => void;
}) {
  const [issueId, setIssueId] = useState(initialIssueId ?? "");
  const [trackedIssue, setTrackedIssue] = useState<IssueRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    setIssueId(initialIssueId ?? "");
  }, [initialIssueId]);

  const handleTrack = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const trimmed = issueId.trim();
    if (!trimmed) {
      setError("Issue id is required");
      return;
    }

    setLoading(true);
    setError("");
    setTrackedIssue(null);
    try {
      const issue = await issueApi.get(trimmed);
      setTrackedIssue(issue);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to track issue");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-md border border-[var(--docs-border)] bg-[var(--docs-surface)] px-3 py-2 font-mono text-[13px] text-[var(--docs-fg)] placeholder:text-[var(--docs-muted)] focus:outline-none focus:border-[var(--docs-amber)] focus:ring-1 focus:ring-[var(--docs-amber)]/40 transition-colors";
  const labelCls =
    "mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-[var(--docs-muted)]";

  return (
    <div
      className="docs-theme fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="track-issue-modal-title"
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-[var(--docs-border)] bg-[var(--docs-bg)] shadow-md">
        <div className="flex items-center justify-between border-b border-[var(--docs-border)] px-5 py-3">
          <h3 id="track-issue-modal-title" className="text-base font-semibold text-[var(--docs-fg)]">
            Track Issue Status
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 font-mono text-sm text-[var(--docs-muted)] hover:text-[var(--docs-fg)]"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleTrack} className="px-5 py-4 space-y-4">
          <div>
            <label className={labelCls}>Issue ID</label>
            <input
              type="text"
              value={issueId}
              onChange={(e) => setIssueId(e.target.value)}
              placeholder="Enter issue id"
              className={inputCls}
            />
            {error ? <div className="mt-1 font-mono text-[11px] text-[var(--docs-danger)]">{error}</div> : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--docs-border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--docs-border)] bg-[var(--docs-surface)] px-3 py-1.5 font-mono text-xs text-[var(--docs-fg-soft)] hover:text-[var(--docs-fg)] hover:bg-[var(--docs-surface-2)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md border border-[var(--docs-amber)] bg-[var(--docs-amber)] px-3 py-1.5 font-mono text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {loading ? "Tracking..." : "Track Issue"}
            </button>
          </div>
        </form>

        {trackedIssue ? (
          <div className="border-t border-[var(--docs-border)] px-5 py-4 space-y-3">
            <div className="rounded-md border border-[var(--docs-border)] bg-[var(--docs-surface-2)] p-4">
              <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--docs-muted)]">
                Current status
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full border border-[var(--docs-border)] bg-[var(--docs-surface)] px-2 py-0.5 font-mono text-xs text-[var(--docs-fg)]">
                  {trackedIssue.status}
                </span>
                <span className="font-mono text-xs text-[var(--docs-muted)]">
                  {trackedIssue.issue_id}
                </span>
              </div>
            </div>
            <div className="grid gap-2 text-sm text-[var(--docs-fg-soft)]">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--docs-muted)]">Domain</span>
                <div className="mt-1 break-all text-[var(--docs-fg)]">{trackedIssue.domain}</div>
              </div>
              <div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--docs-muted)]">Email</span>
                <div className="mt-1 break-all text-[var(--docs-fg)]">{trackedIssue.email}</div>
              </div>
              <div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--docs-muted)]">Updated</span>
                <div className="mt-1 text-[var(--docs-fg)]">{new Date(trackedIssue.updated_at).toLocaleString()}</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
