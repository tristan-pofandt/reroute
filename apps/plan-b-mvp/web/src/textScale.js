// Marks <html data-text="large"> when the system font size is well above default (root font-size > 18px; the default is 16px), so the CSS
// can wrap rows and stack columns for big text. At the default size nothing is set and the layout is exactly the designed one.
const root = document.documentElement;
const apply = () => {
  const large = parseFloat(getComputedStyle(root).fontSize) > 18;
  if (large) root.dataset.text = "large"; else delete root.dataset.text;
};
apply();
addEventListener("resize", apply);
addEventListener("focus", apply);
