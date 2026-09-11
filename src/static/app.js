document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("flight-form");
  const alertButton = document.getElementById("alert-button");
  const alertMessage = document.getElementById("alert-message");
  const targetPrice = document.getElementById("target-price");
  const resultsHeading = document.getElementById("results-heading");
  const resultCount = document.querySelector(".result-count");
  const airlineSelect = document.getElementById("airline-select");
  const excludedAirlines = document.getElementById("excluded-airlines");
  const emptyResults = document.getElementById("empty-results");
  const flightCards = [...document.querySelectorAll(".flight-card")];
  const excluded = new Set();

  flightCards
    .map((card) => card.dataset.airline)
    .filter((airline, index, airlines) => airline && airlines.indexOf(airline) === index)
    .forEach((airline) => {
      const option = document.createElement("option");
      option.value = airline;
      option.textContent = airline;
      airlineSelect.appendChild(option);
    });

  const updateResults = () => {
    let visibleCount = 0;
    flightCards.forEach((card) => {
      const isVisible = !excluded.has(card.dataset.airline);
      card.hidden = !isVisible;
      if (isVisible) visibleCount += 1;
    });

    resultCount.textContent = `${visibleCount} option${visibleCount === 1 ? "" : "s"} · sorted by price`;
    emptyResults.hidden = visibleCount > 0;
    excludedAirlines.replaceChildren();
    [...excluded].forEach((airline) => {
      const chip = document.createElement("span");
      chip.className = "excluded-airline";
      chip.textContent = airline;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "remove-exclusion";
      removeButton.setAttribute("aria-label", `Show ${airline} flights again`);
      removeButton.textContent = "×";
      removeButton.addEventListener("click", () => {
        excluded.delete(airline);
        updateResults();
      });

      chip.appendChild(removeButton);
      excludedAirlines.appendChild(chip);
    });
  };

  airlineSelect.addEventListener("change", () => {
    if (airlineSelect.value) {
      excluded.add(airlineSelect.value);
      airlineSelect.value = "";
      updateResults();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const origin = document.getElementById("origin").value.trim().toUpperCase() || "MCI";
    document.getElementById("origin").value = origin;
    resultsHeading.textContent = "Best matches";
    updateResults();
    alertMessage.textContent = "Search criteria saved — connect a provider for live fares.";
    alertMessage.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
