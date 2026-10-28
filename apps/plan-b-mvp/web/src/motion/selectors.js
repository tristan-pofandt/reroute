// The same selectors motion.js used, so legacy markup and native screens that reuse the classes behave identically.
export const PRESSABLE = ".btn, .icon-btn, .nav-back, .nav-action, .home-btn, button.row, a.row, .panic-btn, .panic-go, .panic-chip, .panic-exit, .segmented button, .stepper button, .card-body, .impact-btn, .cost-toggle";
export const HOVERABLE = ".btn, .icon-btn, .panic-go, .panic-chip, .card, .impact-btn";
// Blocks that fly in on the Z axis as they enter a scroll area: every direct child of a scroll area that is a real block (at least 40 px
// tall, not a heading / caption), plus chart cards. `[data-fm-off]` on the block or an ancestor opts out.
export const REVEAL = ".scroll > *, .sheet-scroll > *, .scroll .chart-card";
export const NOT_BLOCK = ".section-header, .eyebrow, .fine, .visually-hidden, h1, h2, h3, h4, p, script, style, [hidden]";
