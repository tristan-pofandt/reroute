const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const dateTime = (value) => new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value));
const plural = (number, word) => `${number} ${word}${number === 1 ? "" : "s"}`;
let result = null;
let selectedId = null;
let openId = null;

function mapsUrl(origin, destination, mode) {
  const parameters = new URLSearchParams({ api: "1", origin, destination, travelmode: mode === "drive" ? "driving" : "transit" });
  return `https://www.google.com/maps/dir/?${parameters}`;
}

function updateMapHandoffs() {
  const origin = $("#origin").value.trim();
  const destination = $("#destination").value.trim();
  for (const [mode, checkbox, link] of [["transit", "#mode-transit", "#transit-map-link"], ["drive", "#mode-drive", "#drive-map-link"]]) {
    const anchor = $(link);
    anchor.hidden = !$(checkbox).checked;
    if (origin.length >= 3 && destination.length >= 3 && origin.toLowerCase() !== destination.toLowerCase()) {
      anchor.href = mapsUrl(origin, destination, mode);
      anchor.removeAttribute("aria-disabled");
    } else {
      anchor.removeAttribute("href");
      anchor.setAttribute("aria-disabled", "true");
    }
  }
}

function fareLabel(option) {
  if (option.mode === "drive") return "Unknown";
  if (option.fare === null) return "Unknown";
  if (option.currency === "AUD") return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(option.fare);
  return `${option.fare.toFixed(2)} ${option.currency || "currency unknown"}`;
}

function sortedOptions() {
  const key = $("#sort-by").value;
  return [...result.options].sort((a, b) => Number(b.fits) - Number(a.fits) || (
    key === "arrival" ? new Date(a.arrival) - new Date(b.arrival) :
    key === "cost" ? (a.fare ?? Infinity) - (b.fare ?? Infinity) || new Date(a.arrival) - new Date(b.arrival) :
    (a.walking_minutes ?? Infinity) - (b.walking_minutes ?? Infinity) || new Date(a.arrival) - new Date(b.arrival)
  ));
}

function card(option) {
  const chosen = selectedId === option.id;
  const details = openId === option.id;
  const buffer = Math.round((new Date(result.deadline) - new Date(option.arrival)) / 60000);
  const badge = chosen ? "✓ Selected" : option.fits ? "✓ Fits your limits" : "Check limits";
  const reason = option.reasons.length ? option.reasons.join("; ") : "Within your stated time, fare and walking limits";
  return `<article class="option-card${chosen ? " selected" : ""}" aria-label="${escapeHtml(option.title)}">
    <div class="card-header"><div><div class="card-kicker">${option.mode === "drive" ? "YOUR OWN CAR" : "PUBLIC TRANSPORT"}</div><h3 class="card-title">${escapeHtml(option.title)}</h3></div><span class="card-badge ${chosen ? "selected-badge" : option.fits ? "fit" : "miss"}">${badge}</span></div>
    <div class="card-metrics"><div class="metric"><small>Estimated arrival</small><strong>${escapeHtml(dateTime(option.arrival))}</strong></div><div class="metric"><small>Deadline buffer</small><strong class="${buffer < 0 ? "late" : buffer < 5 ? "tight" : "early"}">${buffer < 0 ? `${plural(-buffer, "min")} late` : `${plural(buffer, "min")} early`}</strong></div><div class="metric"><small>${option.mode === "drive" ? "Driving cost" : "Total fare"}</small><strong>${escapeHtml(fareLabel(option))}</strong></div><div class="metric"><small>Total walking</small><strong>${option.walking_minutes === null ? "Unknown" : plural(option.walking_minutes, "min")}</strong></div></div>
    <p class="card-explanation"><strong>${option.fits ? "Why it fits:" : "Check before choosing:"}</strong> ${escapeHtml(reason)}. ${plural(option.transfers, "transfer")}.</p>
    <div class="card-actions"><button type="button" data-action="details" data-id="${option.id}" aria-expanded="${details}" aria-controls="detail-${option.id}">${details ? "Hide" : "View"} journey details <span aria-hidden="true">${details ? "↑" : "↓"}</span></button><button type="button" class="select-action" data-action="select" data-id="${option.id}" ${chosen ? "disabled" : ""}>${chosen ? "Selected" : option.fits ? "Choose this route" : "Choose and verify"}</button></div>
    <div id="detail-${option.id}" class="card-details" ${details ? "" : "hidden"}><strong>Estimated journey: ${plural(option.duration_minutes, "minute")}</strong><div class="detail-grid"><span><b>${option.walking_minutes === null ? "?" : option.walking_minutes}</b>walking min</span><span><b>${option.transfers}</b>transfers</span><span><b>${escapeHtml(fareLabel(option))}</b>${option.mode === "drive" ? "cost" : "total fare"}</span></div>${option.other_minutes > 0 ? `<p class="step-caveat">About ${plural(option.other_minutes, "min")} of the total is outside the listed steps; this can include waiting or connections.</p>` : ""}<strong>Route steps</strong><ol>${option.steps.map((step) => `<li>${escapeHtml(step.title)}${step.minutes === null ? "" : ` — about ${plural(step.minutes, "min")}`}</li>`).join("")}</ol><p class="step-caveat">Detailed navigation, stop access and service status should be checked in Google Maps or Translink.</p></div>
  </article>`;
}

function render() {
  if (!result) return;
  const options = sortedOptions();
  const fitCount = options.filter((option) => option.fits).length;
  $("#result-count").textContent = `${options.length} estimated ${options.length === 1 ? "route" : "routes"}`;
  $("#fit-summary").textContent = `${fitCount} ${fitCount === 1 ? "route meets" : "routes meet"} every known limit`;
  $("#no-match").hidden = fitCount > 0 || !options.length;
  $("#option-list").innerHTML = options.length ? options.map(card).join("") : `<div class="no-match"><span aria-hidden="true">◇</span><div><strong>${result.errors.length ? "Route lookup could not return an option." : "No routes returned for these places and modes."}</strong><p>${result.errors.length ? "Read the lookup error below and try again." : "Try a different departure time, destination or mode."}</p></div></div>`;
  $("#checked-at").textContent = dateTime(result.queried_at);
  $("#partial-errors").hidden = !result.errors.length;
  $("#partial-errors").textContent = result.errors.join(" ");
  $("#results-content").hidden = false;
  const chosen = options.find((option) => option.id === selectedId);
  $("#next-step").hidden = !chosen;
  if (!chosen) return;
  $("#selected-summary").textContent = `${chosen.title} · estimated arrival ${dateTime(chosen.arrival)}. ${chosen.fits ? "Within your stated limits." : `Verify before travel: ${chosen.reasons.join("; ")}.`}`;
  $("#step-list").innerHTML = chosen.steps.map((step) => `<li><strong>${escapeHtml(step.title)}</strong><span>${step.minutes === null ? "Check directions" : `About ${plural(step.minutes, "min")}`}</span></li>`).join("");
  $("#maps-link").href = mapsUrl(result.origin, result.destination, chosen.mode);
}

async function initialise() {
  try {
    const response = await fetch("/api/status");
    if (!response.ok) throw new Error();
    const status = await response.json();
    $("#departure").value = status.departure;
    $("#deadline").value = status.deadline;
    if (status.live_available) {
      $("#status-notice").textContent = "Ready for a Google Maps route search. Times are estimates and disruption status is not checked.";
    } else {
      $("#status-notice").textContent = "In-app route comparison needs MAPS_API_KEY on the local server. The Google Maps journey links in the form work without a key.";
      $("#find-button").disabled = true;
    }
  } catch {
    $("#status-notice").textContent = "Start the local Python server to compare routes here. The Google Maps journey links below still work without a key.";
    $("#find-button").disabled = true;
  }
}

$("#journey-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = $("#form-error");
  const payload = {
    origin: $("#origin").value.trim(), destination: $("#destination").value.trim(),
    departure: $("#departure").value, deadline: $("#deadline").value,
    budget: $("#budget").value, walking: $("#walking").value,
    modes: { transit: $("#mode-transit").checked, drive: $("#mode-drive").checked },
  };
  if (payload.origin.length < 3 || payload.destination.length < 3 || !payload.departure || !payload.deadline || !payload.budget || !payload.walking || !Object.values(payload.modes).some(Boolean)) {
    error.textContent = "Complete both places, both times, both limits and choose a mode.";
    error.hidden = false;
    return;
  }
  error.hidden = true;
  $("#find-button").disabled = true;
  $("#status-notice").textContent = "Looking up routes…";
  try {
    const response = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Route search failed.");
    result = data;
    selectedId = null;
    openId = null;
    render();
    $("#status-notice").textContent = data.options.length ? "Google Maps route estimates returned. Check service status and unknown costs before travelling." : "No route estimates were returned. Review the message below or try another search.";
    $("#results-title").focus({ preventScroll: true });
    $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (failure) {
    error.textContent = failure.message || "Route search failed. Try again.";
    error.hidden = false;
    $("#status-notice").textContent = "The search could not be completed.";
  } finally {
    $("#find-button").disabled = false;
  }
});

$("#sort-by").addEventListener("change", render);
$("#journey-form").addEventListener("input", updateMapHandoffs);
$("#journey-form").addEventListener("change", updateMapHandoffs);
$("#journey-form").addEventListener("focusout", updateMapHandoffs);
$("#journey-form").addEventListener("focusin", (event) => { if (event.target.closest(".map-handoffs")) updateMapHandoffs(); });
$("#journey-form").addEventListener("click", (event) => { if (event.target.closest(".map-handoffs")) updateMapHandoffs(); });
$("#option-list").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "details") {
    openId = openId === button.dataset.id ? null : button.dataset.id;
    render();
    $("#option-list button[data-action='details'][data-id='" + button.dataset.id + "']").focus();
  } else {
    selectedId = button.dataset.id;
    openId = selectedId;
    render();
    $("#next-step").scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

updateMapHandoffs();
initialise();
