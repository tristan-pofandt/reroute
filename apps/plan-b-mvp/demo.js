/* All routes, prices, services and timings below are fictional teaching fixtures. */
const START_MINUTES = 8 * 60 + 20;
const OPTIONS = [
  {
    id: "wait", mode: "bus", title: "Wait for the next bus", label: "STAY AT THE STOP", duration: 47,
    cost: 0, walking: 3, transfers: 0, breakdown: { walk: 3, wait: 12, ride: 32 },
    steps: [["Walk to the bus stop", "3 minutes of walking"], ["Wait for the next bus", "12 minutes of waiting"], ["Ride to campus", "32 minutes on board"]]
  },
  {
    id: "bus-b", mode: "bus", title: "Walk to Stop B + Bus B", label: "ANOTHER BUS", duration: 34,
    cost: 1, walking: 8, transfers: 0, breakdown: { walk: 8, wait: 4, ride: 22 },
    steps: [["Walk to Stop B", "6 minutes of walking"], ["Wait for Bus B", "4 minutes of waiting"], ["Ride towards campus", "22 minutes on board"], ["Walk to your destination", "2 minutes of walking"]]
  },
  {
    id: "rideshare", mode: "rideshare", title: "Take a rideshare", label: "DIRECT DRIVE", duration: 22,
    cost: 18, walking: 2, transfers: 0, breakdown: { walk: 2, wait: 4, ride: 16 },
    steps: [["Walk to the pickup point", "2 minutes of walking"], ["Wait for pickup", "4 minutes of waiting"], ["Travel to campus", "16 minutes in the vehicle"]]
  }
];

const $ = (selector) => document.querySelector(selector);
const formatTime = (minutes) => {
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
};
const formatMoney = (value) => `$${value.toFixed(0)}`;
const plural = (count, noun) => `${count} ${noun}${count === 1 ? "" : "s"}`;
const parseTime = (value) => {
  if (!/^\d{2}:\d{2}$/.test(value)) return NaN;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
};

let constraints = { deadline: 9 * 60, budget: 5, walking: 10, bus: true, rideshare: true };
let selectedId = null;
let openId = null;

function evaluate(option) {
  const buffer = constraints.deadline - (START_MINUTES + option.duration);
  const reasons = [];
  if (!constraints[option.mode]) reasons.push(`${option.mode === "bus" ? "Bus" : "Rideshare"} is unavailable to you`);
  if (buffer < 0) reasons.push(`${plural(Math.abs(buffer), "minute")} after your deadline`);
  if (option.cost > constraints.budget) reasons.push(`${formatMoney(option.cost - constraints.budget)} over your extra-cost limit`);
  if (option.walking > constraints.walking) reasons.push(`${plural(option.walking - constraints.walking, "minute")} over your walking limit`);
  return { ...option, arrival: START_MINUTES + option.duration, buffer, reasons, fits: reasons.length === 0 };
}

function sortedOptions() {
  const order = $("#sort-by").value;
  const compare = {
    arrival: (a, b) => a.arrival - b.arrival,
    cost: (a, b) => a.cost - b.cost || a.arrival - b.arrival,
    walking: (a, b) => a.walking - b.walking || a.arrival - b.arrival
  }[order];
  return OPTIONS.map(evaluate).sort((a, b) => Number(b.fits) - Number(a.fits) || compare(a, b));
}

function bufferLabel(buffer) {
  if (buffer < 0) return `${plural(Math.abs(buffer), "min")} late`;
  if (buffer === 0) return "Exactly on time";
  if (buffer < 5) return `${plural(buffer, "min")} early · tight`;
  return `${plural(buffer, "min")} early`;
}

function summary(option) {
  if (!option.fits) return `Outside your limits: ${option.reasons.join("; ")}.`;
  if (option.buffer < 5) return "Fits your limits, with very little time to spare.";
  return `Fits your limits. Arrives ${plural(option.buffer, "minute")} before your deadline.`;
}

function renderCard(option) {
  const chosen = selectedId === option.id;
  const details = openId === option.id;
  const modeAvailable = constraints[option.mode];
  const bufferClass = option.buffer < 0 ? "late" : option.buffer < 5 ? "tight" : "early";
  return `<article class="option-card${chosen ? " selected" : ""}${chosen && !option.fits ? " outside" : ""}" aria-label="${option.title}">
    <div class="card-header"><div><div class="card-kicker">${option.label}</div><h3 class="card-title">${option.title}</h3></div><span class="card-badge ${chosen && option.fits ? "selected-badge" : option.fits ? "fit" : "miss"}">${chosen ? option.fits ? "✓ Selected · fits" : "✓ Selected · outside limits" : option.fits ? "✓ Fits your limits" : "! Outside limits"}</span></div>
    <div class="card-metrics"><div class="metric"><small>Estimated arrival</small><strong>${formatTime(option.arrival)}</strong></div><div class="metric"><small>Deadline buffer</small><strong class="${bufferClass}">${bufferLabel(option.buffer)}</strong></div><div class="metric"><small>Extra cost</small><strong>${formatMoney(option.cost)}</strong></div><div class="metric"><small>Total walking</small><strong>${plural(option.walking, "min")}</strong></div></div>
    <p class="card-explanation"><strong>${option.fits ? "Why it works:" : "Why it falls outside:"}</strong> ${summary(option)} ${option.transfers} transfers.</p>
    <div class="card-actions"><button type="button" data-action="details" data-id="${option.id}" aria-expanded="${details}" aria-controls="detail-${option.id}">${details ? "Hide" : "View"} journey details <span aria-hidden="true">${details ? "↑" : "↓"}</span></button><button type="button" class="select-action" data-action="select" data-id="${option.id}" ${chosen || !modeAvailable ? "disabled" : ""}>${chosen ? "Selected" : !modeAvailable ? "Mode unavailable" : option.fits ? "Choose this route" : "Choose outside limits"}</button></div>
    <div id="detail-${option.id}" class="card-details" ${details ? "" : "hidden"}><strong>Whole journey: ${plural(option.duration, "minute")}</strong><div class="detail-grid"><span><b>${plural(option.breakdown.walk, "min")}</b>walking total</span><span><b>${plural(option.breakdown.wait, "min")}</b>waiting</span><span><b>${plural(option.breakdown.ride, "min")}</b>on board / driving</span><span><b>${option.transfers}</b>transfers</span></div><strong>Prepared steps</strong><ol>${option.steps.map(([name, detail]) => `<li>${name} — ${detail}</li>`).join("")}</ol></div>
  </article>`;
}

function renderSelection() {
  const container = $("#next-step");
  const selected = OPTIONS.map(evaluate).find((option) => option.id === selectedId);
  if (!selected) { container.hidden = true; return; }
  container.hidden = false;
  $("#selected-summary").textContent = `${selected.title} · estimated ${formatTime(selected.arrival)} arrival · ${bufferLabel(selected.buffer)}. ${selected.fits ? "Fits your current limits." : `Chosen despite: ${selected.reasons.join("; ")}.`}`;
  $("#step-list").innerHTML = selected.steps.map(([name, detail]) => `<li><strong>${name}</strong><span>${detail}</span></li>`).join("");
  $("#verify-copy").textContent = selected.mode === "rideshare" ? "These are fictional instructions. Confirm pickup, final price and route with your chosen rideshare provider. Translink can help you compare actual public transport." : "These are fictional instructions. Check the actual service, stop location and directions with Translink before travelling.";
}

function render() {
  const options = sortedOptions();
  const fitCount = options.filter((option) => option.fits).length;
  $("#result-count").textContent = `${options.length} prepared options`;
  $("#banner-deadline").textContent = formatTime(constraints.deadline);
  $("#fit-summary").textContent = fitCount === 1 ? "1 option fits your limits" : `${fitCount} options fit your limits`;
  $("#no-match").hidden = fitCount > 0;
  $("#option-list").innerHTML = options.map(renderCard).join("");
  renderSelection();
}

$("#constraints-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const deadline = parseTime($("#deadline").value);
  const budget = Number($("#budget").value);
  const walking = Number($("#walking").value);
  const error = $("#form-error");
  if (!$("#budget").value.trim() || !$("#walking").value.trim() || !Number.isFinite(deadline) || deadline < START_MINUTES || deadline > 720 || !Number.isInteger(budget) || budget < 0 || budget > 100 || !Number.isInteger(walking) || walking < 0 || walking > 60) {
    error.textContent = "Use an arrival time from 8:20 am to noon, a cost from $0 to $100, and walking from 0 to 60 minutes.";
    error.hidden = false;
    return;
  }
  error.hidden = true;
  constraints = { deadline, budget, walking, bus: $("#mode-bus").checked, rideshare: $("#mode-rideshare").checked };
  selectedId = null;
  openId = null;
  render();
  $("#results-title").focus({ preventScroll: true });
  $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#sort-by").addEventListener("change", render);
$("#option-list").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = button.dataset.id;
  if (button.dataset.action === "details") {
    openId = openId === id ? null : id;
    render();
    $("#option-list button[data-action='details'][data-id='" + id + "']").focus();
    return;
  }
  if (button.dataset.action === "select") {
    selectedId = id;
    openId = id;
    render();
    $("#next-step").scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

render();
