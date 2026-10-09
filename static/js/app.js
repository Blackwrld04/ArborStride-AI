/**
 * ArborStride AI - Landing Page Interactions
 */

document.addEventListener("DOMContentLoaded", () => {
  // Duration pill selection
  const durationPills = document.querySelectorAll(".duration-pill");
  const targetInput = document.querySelector('input[name="target"]');

  durationPills.forEach(pill => {
    pill.addEventListener("click", () => {
      durationPills.forEach(p => p.classList.remove("is-active"));
      pill.classList.add("is-active");
      const mins = pill.getAttribute("data-mins");
      if (targetInput) {
        targetInput.value = `${mins} Min Tree-Shaded Loop`;
      }
    });
  });

  // Mode tab switching
  const tabLoop = document.getElementById("tab-loop");
  const tabDirect = document.getElementById("tab-direct");

  if (tabLoop && tabDirect) {
    tabLoop.addEventListener("click", () => {
      tabLoop.classList.add("is-active");
      tabDirect.classList.remove("is-active");
      if (targetInput) targetInput.value = "30 Min Tree-Shaded Loop";
    });

    tabDirect.addEventListener("click", () => {
      tabDirect.classList.add("is-active");
      tabLoop.classList.remove("is-active");
      if (targetInput) targetInput.value = "High-Canopy Destination Park";
    });
  }
});
