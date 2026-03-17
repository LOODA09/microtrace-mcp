import "./ui/tooltip";

console.log(`  
     █████╗ ████████╗██╗
    ██╔══██║╚══██╔══╝██║░░░░░
    ██║░░██║░░░██║░░░██║░░░░░
    ██║░░██║░░░██║░░░██║░░░░░
    ██╚══██║░░░██║░░░███████╗
    ╚█████╝ ░░░╚═╝░░░╚══════╝
`);

// ------- Lightmode -------
let themeMode: string | null = localStorage.getItem("themeMode");
const themeSwitch = document.getElementById("themeSwitch");

const enableLightmode = () => {
  document.body.dataset.lightTheme = "true";
  localStorage.setItem("themeMode", "light");
};

const disableLightmode = () => {
  document.body.dataset.lightTheme = "false";
  localStorage.setItem("themeMode", "dark");
};

if (themeMode === "light") enableLightmode();

themeSwitch?.addEventListener("click", () => {
  themeMode = localStorage.getItem("themeMode");
  themeMode !== "light" ? enableLightmode() : disableLightmode();
});

// ------- End of Lightmode -------

// ------- Hamburger Menu -------

const hamburger = document.getElementById("mobileNavBtn");
const mobileNav = document.getElementById("navLinks");
const navLinks = document.querySelectorAll(".navMain");
const main = document.getElementById("main");
const body = document.body;

function toggleMenu() {
  const isOpen = mobileNav?.classList.toggle("active");
  hamburger?.classList.toggle("active");
  hamburger?.setAttribute("aria-expanded", String(isOpen));
  mobileNav?.setAttribute("aria-hidden", String(!isOpen));

  if (isOpen) {
    document.body.style.overflow = "hidden"; // Prevent scrolling
    main?.addEventListener("click", toggleMenu);
    document.addEventListener("keydown", handleEscape);
  } else {
    document.body.style.overflow = ""; // Restore scrolling
    main?.removeEventListener("click", toggleMenu);
    document.removeEventListener("keydown", handleEscape);
  }
}

hamburger?.addEventListener("click", toggleMenu);

// close when a link is clicked
navLinks?.forEach((link) => {
  link.addEventListener("click", toggleMenu);
});

// click outside to close
// main?.addEventListener("click", toggleMenu);

// close on Escape
function handleEscape(e: KeyboardEvent) {
  if (e.key === "Escape") toggleMenu();
}

// ------- End of Hamburger Menu -------
