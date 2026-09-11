document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("flight-form");
  const alertButton = document.getElementById("alert-button");
  const alertMessage = document.getElementById("alert-message");
  const targetPrice = document.getElementById("target-price");
  const resultsHeading = document.getElementById("results-heading");
  const resultCount = document.querySelector(".result-count");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const origin = document.getElementById("origin").value.trim().toUpperCase() || "MCI";
    document.getElementById("origin").value = origin;
    resultsHeading.textContent = "Best matches";
    resultCount.textContent = "3 mock options · sorted by price";
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
