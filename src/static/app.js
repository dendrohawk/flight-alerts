document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("flight-form");
  const alertButton = document.getElementById("alert-button");
  const alertMessage = document.getElementById("alert-message");
  const targetPrice = document.getElementById("target-price");
  const resultsHeading = document.getElementById("results-heading");
  const resultCount = document.querySelector(".result-count");
  const results = document.getElementById("flight-results");
  const disclaimer = document.getElementById("result-disclaimer");
  const providerStatus = document.getElementById("provider-status");
  const searchButton = form.querySelector("button[type=submit]");
  const sampleResults = results.innerHTML;

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const formatPrice = (price) => price ? `$${Number(price).toLocaleString()}` : "Price unavailable";
  const formatDuration = (minutes) => {
    if (!minutes) return "Duration unavailable";
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const renderFlights = (flights) => {
    results.innerHTML = flights.map((flight, index) => `
      <article class="flight-card${index === 0 ? " featured" : ""}">
        ${index === 0 ? '<div class="best-value">BEST VALUE</div>' : ""}
        <div class="flight-main">
          <div class="airline"><span class="airline-logo">${escapeHtml((flight.airline_code || flight.airline || "FL").slice(0, 2))}</span><div><strong>${escapeHtml(flight.airline)}</strong><small>${escapeHtml(flight.flight_number)}</small></div></div>
          <div class="flight-times"><div><strong>${escapeHtml(flight.departure_time)}</strong><small>${escapeHtml(flight.departure_airport)}</small></div><span class="duration">${escapeHtml(formatDuration(flight.duration))} <i>—</i> nonstop</span><div><strong>${escapeHtml(flight.arrival_time)}</strong><small>${escapeHtml(flight.arrival_airport)}</small></div></div>
          <div class="price"><strong>${escapeHtml(formatPrice(flight.price))}</strong><small>round trip / ${escapeHtml(document.getElementById("travelers").value)}</small></div>
        </div>
        <div class="flight-meta"><span>${escapeHtml(flight.searched_date)} · return ${escapeHtml(flight.return_date || "selected date")}</span><span>${escapeHtml(flight.arrival_airport)} · live provider</span>${flight.booking_link ? `<a href="${escapeHtml(flight.booking_link)}" target="_blank" rel="noreferrer">Book on Google Flights ↗</a>` : "<span>Provider booking link unavailable</span>"}</div>
      </article>
    `).join("");
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const origin = document.getElementById("origin").value.trim().toUpperCase() || "MCI";
    document.getElementById("origin").value = origin;
    searchButton.disabled = true;
    searchButton.innerHTML = "Searching live fares…";
    resultsHeading.textContent = "Searching";
    resultCount.textContent = "Checking provider availability…";
    providerStatus.innerHTML = '<span class="spark">✦</span><span><strong>Live search</strong><br />Checking Google Flights data securely.</span>';

    try {
      const response = await fetch("/api/flights/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          destination: document.getElementById("destination").value,
          travelers: Number(document.getElementById("travelers").value) || 2,
          outbound_window: document.getElementById("outbound-window").value,
          arrival_deadline: document.getElementById("arrival-deadline").value,
          return_timing: document.getElementById("return-timing").value,
          excluded_airlines: []
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Search criteria could not be sent.");

      if (payload.provider === "serpapi" && payload.flights.length) {
        renderFlights(payload.flights);
        resultsHeading.textContent = "Live matches";
        resultCount.textContent = `${payload.flights.length} live options · sorted by price`;
        disclaimer.textContent = (payload.limitations || []).join(" ");
        providerStatus.innerHTML = `<span class="spark">✦</span><span><strong>Live provider connected</strong><br />Searched ${payload.searched_dates} outbound date${payload.searched_dates === 1 ? "" : "s"}.</span>`;
      } else {
        results.innerHTML = sampleResults;
        resultsHeading.textContent = "Sample matches";
        resultCount.textContent = "3 sample options · sorted by price";
        disclaimer.textContent = "Sample results shown for planning. Live provider data was unavailable for this search.";
        providerStatus.innerHTML = `<span class="spark">✦</span><span><strong>Sample planning state</strong><br />${escapeHtml(payload.reason || "No live fares were returned.")}</span>`;
      }
    } catch (error) {
      results.innerHTML = sampleResults;
      resultsHeading.textContent = "Sample matches";
      resultCount.textContent = "3 sample options · sorted by price";
      disclaimer.textContent = "Sample results shown for planning. The live search could not be completed.";
      providerStatus.innerHTML = `<span class="spark">✦</span><span><strong>Search unavailable</strong><br />${escapeHtml(error.message)}</span>`;
    } finally {
      searchButton.disabled = false;
      searchButton.innerHTML = 'Find affordable flights <span>↗</span>';
    }
  });

  alertButton.addEventListener("click", () => {
    const price = Number(targetPrice.value);
    if (!price || price < 1) {
      alertMessage.textContent = "Enter a target price above $0.";
      alertMessage.style.color = "#b42318";
      targetPrice.focus();
      return;
    }
    alertMessage.style.color = "";
    alertMessage.textContent = `Price alert ready at $${price.toLocaleString()} for 2 tickets.`;
    alertButton.textContent = "Alert created ✓";
    alertButton.disabled = true;
  });
});
