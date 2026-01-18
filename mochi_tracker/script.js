document.addEventListener("DOMContentLoaded", () => {
  let expenses = JSON.parse(localStorage.getItem("expenses")) || [];
  let categories = JSON.parse(localStorage.getItem("categories")) || [
    "Food",
    "Transport",
    "Housing",
    "Fun",
    "Shopping",
    "Other",
  ];
  let budgets = JSON.parse(localStorage.getItem("budgets")) || {
    monthly: 0,
    categoryBudgets: {},
  };
  let currency = localStorage.getItem("currency") || "AUD";
  let rates = { AUD: 1, USD: 0.65, INR: 54 }; // approximate rates
  let theme = localStorage.getItem("theme") || "dark";

  const haikyuuQuotes = [
    "Don't you ever forget that I'll be here to beat you!! - Hinata",
    "The view from the summit is breathtaking. - Kageyama",
    "We're like the blood in our veins. We must flow without stopping. - Coach Ukai",
    "If you're gonna hit it, hit it till it breaks. - Oikawa",
    "Talent is something you make bloom, instinct is something you polish. - Oikawa",
  ];
  const funnyQuotes = [
    "Australia: Where your wallet goes to die, but at least the views are free... kinda.",
    "Spending tip: Pretend every dollar is a volleyball – don't let it spike away!",
    "Budgeting in Oz: Because who needs savings when you have sarcasm?",
    "Expense alert: That coffee just cost you a kidney. Good job!",
    "Saanidhya, remember: Money can't buy happiness, but it can buy Tim Tams.",
  ];

  document.getElementById("haikyuu-quote").textContent =
    haikyuuQuotes[Math.floor(Math.random() * haikyuuQuotes.length)];

  // Theme toggle
  document.body.setAttribute("data-bs-theme", theme);
  document.getElementById("theme-toggle").innerHTML =
    theme === "dark"
      ? '<i class="fas fa-sun"></i> Light'
      : '<i class="fas fa-moon"></i> Dark';
  document.getElementById("theme-toggle").onclick = () => {
    theme = theme === "dark" ? "light" : "dark";
    document.body.setAttribute("data-bs-theme", theme);
    localStorage.setItem("theme", theme);
    document.getElementById("theme-toggle").innerHTML =
      theme === "dark"
        ? '<i class="fas fa-sun"></i> Light'
        : '<i class="fas fa-moon"></i> Dark';
  };

  // Currency
  document.getElementById("currency-select").value = currency;
  document.getElementById("currency-select").onchange = (e) => {
    currency = e.target.value;
    localStorage.setItem("currency", currency);
    displayExpenses();
  };

  // Populate categories
  function populateCategories() {
    const select = document.getElementById("category");
    const filter = document.getElementById("category-filter");
    select.innerHTML = "";
    filter.innerHTML = '<option value="">All Categories</option>';
    categories.forEach((cat) => {
      select.innerHTML += `<option>${cat}</option>`;
      filter.innerHTML += `<option>${cat}</option>`;
    });
  }
  populateCategories();

  // Add custom category
  document.getElementById("add-category-btn").onclick = () => {
    const newCat = document.getElementById("new-category").value.trim();
    if (newCat && !categories.includes(newCat)) {
      categories.push(newCat);
      localStorage.setItem("categories", JSON.stringify(categories));
      populateCategories();
      document.getElementById("new-category").value = "";
    }
  };

  // Set budget
  document.getElementById("set-budget").onclick = () => {
    budgets.monthly =
      parseFloat(document.getElementById("monthly-budget").value) || 0;
    localStorage.setItem("budgets", JSON.stringify(budgets));
    displayExpenses();
  };

  function getCurrSymbol() {
    return currency === "INR" ? "₹" : "$";
  }

  function updateBudgetStatus() {
    const currSymbol = getCurrSymbol();
    const spentThisMonth = expenses
      .filter((e) => moment(e.date).isSame(moment(), "month"))
      .reduce((sum, e) => sum + parseFloat(e.amount) * rates[currency], 0);
    const monthlyBudgetConv = budgets.monthly * rates[currency]; // assume budget entered in AUD, convert
    const pct = monthlyBudgetConv
      ? (spentThisMonth / monthlyBudgetConv) * 100
      : 0;
    let msg = `Spent ${currSymbol}${spentThisMonth.toFixed(2)} / ${currSymbol}${monthlyBudgetConv.toFixed(2)} (${pct.toFixed(0)}%)`;
    let color =
      pct < 70 ? "text-success" : pct < 90 ? "text-warning" : "text-danger";
    if (pct > 100) msg += " — Budget exceeded! 😱";
    document.getElementById("budget-status").innerHTML =
      `<span class="${color}">${msg}</span>`;
  }

  function filterExpenses() {
    let filtered = [...expenses];
    const view = document.getElementById("time-view").value;
    const now = moment();
    if (view === "day")
      filtered = filtered.filter((e) => moment(e.date).isSame(now, "day"));
    if (view === "week")
      filtered = filtered.filter((e) => moment(e.date).isSame(now, "week"));
    if (view === "month")
      filtered = filtered.filter((e) => moment(e.date).isSame(now, "month"));

    const catFilter = document.getElementById("category-filter").value;
    if (catFilter) filtered = filtered.filter((e) => e.category === catFilter);

    const keyword = document.getElementById("search-input").value.toLowerCase();
    if (keyword)
      filtered = filtered.filter(
        (e) =>
          e.description.toLowerCase().includes(keyword) ||
          (e.notes || "").toLowerCase().includes(keyword),
      );

    return filtered;
  }

  function displayExpenses() {
    const currSymbol = getCurrSymbol();
    document.getElementById("curr-symbol").textContent = currSymbol;

    const list = document.getElementById("expense-list");
    list.innerHTML = "";
    let total = 0;
    const catTotals = {};
    const filtered = filterExpenses();

    filtered.forEach((exp) => {
      const amount = parseFloat(exp.amount);
      const convAmount = amount * rates[currency];
      total += convAmount;
      catTotals[exp.category] = (catTotals[exp.category] || 0) + convAmount;

      const item = document.createElement("li");
      item.className =
        "list-group-item bg-dark text-white d-flex justify-content-between align-items-center";
      item.innerHTML = `
        ${exp.description} (${exp.notes || ""}) - ${currSymbol}${convAmount.toFixed(2)} (${exp.category}) via ${exp.paymentMethod || "N/A"} on ${exp.date}
        ${exp.recurring ? '<span class="badge bg-warning ms-2">Recurring</span>' : ""}
        <button class="btn btn-sm btn-danger" onclick="deleteExpenseById('${exp.id}')">Delete</button>
      `;
      list.appendChild(item);
    });

    document.getElementById("total-expense").textContent =
      `${currSymbol}${total.toFixed(2)}`;

    updateChart(catTotals);
    updateBudgetStatus();
    updateInsights();
  }

  let chart;
  function updateChart(catTotals) {
    const ctx = document.getElementById("expense-chart").getContext("2d");
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: Object.keys(catTotals),
        datasets: [
          {
            data: Object.values(catTotals),
            backgroundColor: [
              "#FF7518",
              "#e66a15",
              "#000",
              "#FFF",
              "#333",
              "#444",
            ],
          },
        ],
      },
      options: { responsive: true },
    });
  }

  function updateInsights() {
    const currSymbol = getCurrSymbol();
    if (expenses.length === 0) {
      document.getElementById("insights").innerHTML =
        "Add some expenses to get smart insights! 🏐";
      return;
    }

    const catTotals = {};
    expenses.forEach((e) => {
      const amt = parseFloat(e.amount) * rates[currency];
      catTotals[e.category] = (catTotals[e.category] || 0) + amt;
    });

    if (Object.keys(catTotals).length === 0) {
      document.getElementById("insights").innerHTML =
        "No category data yet... start spending! 😅";
      return;
    }

    const highestEntry = Object.entries(catTotals).reduce((max, curr) =>
      curr[1] > max[1] ? curr : max,
    );
    const highestCat = highestEntry[0];
    const highestAmt = highestEntry[1];

    const thisMonth = moment().format("YYYY-MM");
    const lastMonth = moment().subtract(1, "month").format("YYYY-MM");

    const thisMonthTotal = expenses
      .filter((e) => moment(e.date).format("YYYY-MM") === thisMonth)
      .reduce((sum, e) => sum + parseFloat(e.amount) * rates[currency], 0);

    const lastMonthTotal = expenses
      .filter((e) => moment(e.date).format("YYYY-MM") === lastMonth)
      .reduce((sum, e) => sum + parseFloat(e.amount) * rates[currency], 0);

    let trendMsg = "";
    if (lastMonthTotal > 0) {
      const changePct =
        ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
      if (changePct > 20) {
        trendMsg = `Whoa! You're spending ${changePct.toFixed(0)}% more this month — slow down, champ! 🚨`;
      } else if (changePct < -10) {
        trendMsg = `Nice! ${Math.abs(changePct).toFixed(0)}% less spending this month. Keep blocking those expenses! 🛡️`;
      } else {
        trendMsg = `Spending looks pretty stable month-to-month. Consistency wins!`;
      }
    } else {
      trendMsg = "Not enough monthly data for trends yet — keep tracking!";
    }

    document.getElementById("insights").innerHTML = `
      <strong>Highest category:</strong> ${highestCat} (${currSymbol}${highestAmt.toFixed(2)})<br>
      <strong>Trend insight:</strong> ${trendMsg}<br>
      <small>Tip: Watch out for ${highestCat.toLowerCase()} — it's spiking harder than Kageyama's serves! 🏐</small>
    `;
  }

  // Add expense
  document.getElementById("expense-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const newExpense = {
      id: Date.now() + Math.random().toString(36).slice(2),
      description: document.getElementById("description").value,
      amount: document.getElementById("amount").value,
      date:
        document.getElementById("date").value || moment().format("YYYY-MM-DD"),
      category: document.getElementById("category").value,
      paymentMethod: document.getElementById("payment-method").value,
      recurring: document.getElementById("recurring").checked,
      notes: document.getElementById("description").value,
    };
    expenses.push(newExpense);
    localStorage.setItem("expenses", JSON.stringify(expenses));
    displayExpenses();
    bootstrap.Modal.getInstance(
      document.getElementById("addExpenseModal"),
    ).hide();
    alert(funnyQuotes[Math.floor(Math.random() * funnyQuotes.length)]);
    document.getElementById("expense-form").reset();
  });

  window.deleteExpenseById = (id) => {
    expenses = expenses.filter((e) => e.id !== id);
    localStorage.setItem("expenses", JSON.stringify(expenses));
    displayExpenses();
  };

  // Recurring
  function handleRecurring() {
    const now = moment();
    const lastCheck =
      localStorage.getItem("lastRecurCheck") || now.format("YYYY-MM");
    if (now.format("YYYY-MM") !== lastCheck) {
      expenses.forEach((exp) => {
        if (exp.recurring) {
          const copy = {
            ...exp,
            id: Date.now() + Math.random().toString(36).slice(2),
            date: now.format("YYYY-MM-DD"),
          };
          expenses.push(copy);
        }
      });
      localStorage.setItem("expenses", JSON.stringify(expenses));
      localStorage.setItem("lastRecurCheck", now.format("YYYY-MM"));
    }
    displayExpenses();
  }
  handleRecurring();

  // Prediction
  document.getElementById("predict-btn").addEventListener("click", () => {
    const currSymbol = getCurrSymbol();
    if (expenses.length < 5) {
      document.getElementById("prediction-result").textContent =
        "Need at least 5 expenses across a few months for AI magic! 🏐 Add more.";
      return;
    }

    const monthlyTotals = {};
    expenses.forEach((exp) => {
      const month = moment(exp.date).format("YYYY-MM");
      monthlyTotals[month] =
        (monthlyTotals[month] || 0) + parseFloat(exp.amount);
    });

    const months = Object.keys(monthlyTotals).sort();
    const rawData = months.map((m) => monthlyTotals[m]);

    if (rawData.length < 3) {
      document.getElementById("prediction-result").textContent =
        "Not enough unique months. Add from different months!";
      return;
    }

    const minVal = Math.min(...rawData);
    const maxVal = Math.max(...rawData);
    const range = maxVal - minVal || 1;
    const normalized = rawData.map((v) => (v - minVal) / range);

    try {
      const net = new brain.recurrent.LSTMTimeStep({
        inputSize: 1,
        hiddenLayers: [8, 8],
        outputSize: 1,
      });

      net.train([normalized], {
        iterations: 2000,
        errorThresh: 0.005,
        log: true,
        logPeriod: 500,
        learningRate: 0.01,
      });

      const lastFew = normalized.slice(-5);
      const forecastNorm = net.forecast([lastFew], 1)[0];
      const predictedBase = forecastNorm * range + minVal;
      const predicted = predictedBase * rates[currency];

      document.getElementById("prediction-result").innerHTML =
        `AI predicts next month: <strong>${currSymbol}${predicted.toFixed(2)}</strong><br>
        <small>(based on ${rawData.length} months – fly high! 🏐)</small>`;
    } catch (err) {
      console.error("Brain.js error:", err);
      const avgBase = rawData.reduce((a, b) => a + b, 0) / rawData.length;
      const avg = avgBase * rates[currency];
      document.getElementById("prediction-result").textContent =
        `ML got confused 😅. Average so far: ${currSymbol}${avg.toFixed(2)}. Add more data!`;
    }
  });

  // Filters listeners
  ["search-input", "category-filter", "time-view"].forEach((id) => {
    document.getElementById(id).addEventListener("input", displayExpenses);
    document.getElementById(id).addEventListener("change", displayExpenses);
  });
  // Intro Video Logic
  const introOverlay = document.getElementById("intro-overlay");
  const introVideo = document.getElementById("intro-video");
  const skipButton = document.getElementById("skip-intro");

  if (introOverlay && introVideo) {
    // Skip if already seen (prevents replay on reload/refresh)
    if (localStorage.getItem("introSeen")) {
      introOverlay.remove();
    } else {
      // Mark as seen after first play
      localStorage.setItem("introSeen", "true");

      // Hide when video ends
      introVideo.onended = () => {
        introOverlay.style.opacity = "0";
        setTimeout(() => {
          introOverlay.remove(); // fully remove from DOM
        }, 1500); // match fade duration
      };

      // Optional: Skip button
      if (skipButton) {
        skipButton.onclick = () => {
          introVideo.pause();
          introOverlay.style.opacity = "0";
          setTimeout(() => introOverlay.remove(), 1500);
        };
      }

      // Optional: Force play (some browsers need it)
      introVideo.play().catch((err) => console.log("Autoplay prevented:", err));
    }
  }

  displayExpenses();
});
