// app.js shows "Share with other apps" when navigator.share exists and calls it. Android WebViews lack it; route it to the native sheet.
import { Share } from "@capacitor/share";

export function install() {
  navigator.share = (d) => Share.share({ title: d?.title, text: d?.text, url: d?.url, dialogTitle: d?.title }).then(() => {}, (e) => { if (!/cancel/i.test(e?.message || "")) throw e; });
}
