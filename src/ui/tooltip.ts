/**
 * Enhances the UI by replacing native title attributes with custom tooltips
 * and handling other UI interactions.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Select all elements with a title attribute
  const elementsWithTitle = document.querySelectorAll("[title]");

  elementsWithTitle.forEach((el) => {
    const titleText = el.getAttribute("title");
    if (titleText) {
      // Set a data attribute for CSS to use
      el.setAttribute("data-tooltip", titleText);
      // Remove the native title attribute to prevent double tooltips
      el.removeAttribute("title");
      // Add the tooltip class for styling
      el.classList.add("has-tooltip");
    }
  });
});
